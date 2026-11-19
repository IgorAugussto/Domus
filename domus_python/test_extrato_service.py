import pytest
from extrato_service import app, detectar_categoria, processar_parcela, parse_csv, parse_ofx


@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["RATELIMIT_ENABLED"] = False
    with app.test_client() as c:
        yield c
    app.config["RATELIMIT_ENABLED"] = True


# ── detectar_categoria ────────────────────────────────────────

def test_categoria_food_ifood():
    assert detectar_categoria("ifood pedido xpto") == "Food & Dining"


def test_categoria_transporte_uber():
    assert detectar_categoria("UBER corrida") == "Transportation"


def test_categoria_saude():
    assert detectar_categoria("DROGASIL filial 10") == "Healthcare"


def test_categoria_contas():
    assert detectar_categoria("TIM fatura mensal") == "Bills & Utilities"


def test_categoria_desconhecida():
    assert detectar_categoria("transferencia pix recebida") == "Other"


# ── processar_parcela ─────────────────────────────────────────

def test_sem_parcela_retorna_onetime():
    desc, freq, dur, atual, total = processar_parcela("Compra no mercado")
    assert freq == "One-time"
    assert dur == 1
    assert atual == 0
    assert total == 0


def test_parcela_formato_texto():
    desc, freq, dur, atual, total = processar_parcela("LOJA RENNER parcela 3/6")
    assert freq == "Monthly"
    assert atual == 3
    assert total == 6
    assert dur == 4  # max(1, 6 - 3 + 1)
    assert desc == "LOJA RENNER"


def test_parcela_invalida_ignorada():
    # parcela_atual > total_parcelas — deve ser ignorada e retornar One-time
    desc, freq, dur, atual, total = processar_parcela("LOJA parcela 7/6")
    assert freq == "One-time"


def test_parcela_total_zero_ignorada():
    desc, freq, dur, atual, total = processar_parcela("LOJA parcela 1/0")
    assert freq == "One-time"


# ── parse_csv ─────────────────────────────────────────────────

def test_parse_csv_transacao_valida():
    csv = "date,title,amount\n2024-01-15,uber corrida,25.00\n"
    transacoes = parse_csv(csv)
    assert len(transacoes) == 1
    t = transacoes[0]
    assert t["amount"] == 25.00
    assert t["category"] == "Transportation"
    assert t["startDate"] == "2024-01-15"
    assert t["frequency"] == "One-time"


def test_parse_csv_valor_zero_ignorado():
    csv = "date,title,amount\n2024-01-15,teste,0.00\n"
    transacoes = parse_csv(csv)
    assert len(transacoes) == 0


def test_parse_csv_colunas_invalidas_levanta_erro():
    csv = "col1,col2\nvalor1,valor2\n"
    with pytest.raises(ValueError):
        parse_csv(csv)


def test_parse_csv_parcela_detectada():
    csv = "date,title,amount\n2024-01-15,renner parcela 2/4,100.00\n"
    transacoes = parse_csv(csv)
    assert transacoes[0]["frequency"] == "Monthly"
    assert transacoes[0]["installmentNumber"] == 2
    assert transacoes[0]["totalInstallments"] == 4


def test_parse_csv_multiplas_transacoes():
    csv = (
        "date,title,amount\n"
        "2024-01-10,supermercado tauste,120.50\n"
        "2024-01-11,netflix,39.90\n"
    )
    transacoes = parse_csv(csv)
    assert len(transacoes) == 2
    assert transacoes[0]["category"] == "Food & Dining"
    assert transacoes[1]["category"] == "Entertainment"


# ── parse_ofx ─────────────────────────────────────────────────

OFX_TEMPLATE = """<STMTTRN>
<DTPOSTED>{dtposted}
<TRNAMT>{trnamt}
<MEMO>{memo}
</STMTTRN>"""


def test_parse_ofx_debito_valido():
    ofx = OFX_TEMPLATE.format(dtposted="20240115", trnamt="-50.00", memo="SUPERMERCADO TAUSTE")
    transacoes = parse_ofx(ofx)
    assert len(transacoes) == 1
    assert transacoes[0]["amount"] == 50.00
    assert transacoes[0]["category"] == "Food & Dining"
    assert transacoes[0]["startDate"] == "2024-01-15"


def test_parse_ofx_credito_ignorado():
    ofx = OFX_TEMPLATE.format(dtposted="20240115", trnamt="100.00", memo="ESTORNO")
    transacoes = parse_ofx(ofx)
    assert len(transacoes) == 0


def test_parse_ofx_sem_campos_obrigatorios_ignorado():
    ofx = "<STMTTRN>\n<DTPOSTED>20240115\n</STMTTRN>"
    transacoes = parse_ofx(ofx)
    assert len(transacoes) == 0


# ── Endpoints Flask ───────────────────────────────────────────

def test_health_retorna_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"


def test_processar_extrato_sem_arquivo_retorna_400(client):
    resp = client.post("/processar-extrato")
    assert resp.status_code == 400


def test_processar_extrato_formato_invalido_retorna_400(client):
    from io import BytesIO
    data = {"file": (BytesIO(b"conteudo"), "arquivo.txt")}
    resp = client.post("/processar-extrato", data=data, content_type="multipart/form-data")
    assert resp.status_code == 400


def test_processar_extrato_csv_valido_retorna_200(client):
    from io import BytesIO
    csv_content = b"date,title,amount\n2024-01-15,uber corrida,25.00\n"
    data = {"file": (BytesIO(csv_content), "extrato.csv")}
    resp = client.post("/processar-extrato", data=data, content_type="multipart/form-data")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["total"] == 1
    assert body["transacoes"][0]["category"] == "Transportation"


def test_processar_extrato_csv_invalido_retorna_422(client):
    from io import BytesIO
    csv_invalido = b"col1,col2\nvalor1,valor2\n"
    data = {"file": (BytesIO(csv_invalido), "extrato.csv")}
    resp = client.post("/processar-extrato", data=data, content_type="multipart/form-data")
    assert resp.status_code == 422


def test_processar_extrato_ofx_valido_retorna_200(client):
    from io import BytesIO
    ofx = b"""<STMTTRN>
<DTPOSTED>20240115
<TRNAMT>-50.00
<MEMO>SUPERMERCADO TAUSTE
</STMTTRN>"""
    data = {"file": (BytesIO(ofx), "extrato.ofx")}
    resp = client.post("/processar-extrato", data=data, content_type="multipart/form-data")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["total"] == 1
