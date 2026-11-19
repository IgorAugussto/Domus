"""
================================================================
Domus — Microserviço de Processamento de Extratos
================================================================
Responsável por receber arquivos CSV/OFX,
processar e retornar JSON estruturado para o backend Java.

Porta padrão: 5000
Endpoint:     POST /processar-extrato
================================================================
"""

from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import pandas as pd
import pdfplumber
import re
from datetime import datetime
from io import BytesIO, StringIO

app = Flask(__name__)

limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="memory://",
    default_limits=[],
)

# ── Mapeamento de palavras-chave para categorias ─────────────
CATEGORY_MAP = {
    "supermercado": "Food & Dining",
    "mercado":      "Food & Dining",
    "padaria":      "Food & Dining",
    "restaurante":  "Food & Dining",
    "lanche":       "Food & Dining",
    "food":         "Food & Dining",
    "ifood":        "Food & Dining",
    "ifd":          "Food & Dining",
    "parmegian":    "Food & Dining",
    "zarelli":      "Food & Dining",
    "tauste":       "Food & Dining",
    "posto":        "Transportation",
    "combustivel":  "Transportation",
    "uber":         "Transportation",
    "uberrides":    "Transportation",
    "99":           "Transportation",
    "taxi":         "Transportation",
    "transporte":   "Transportation",
    "drogasil":     "Healthcare",
    "farmacia":     "Healthcare",
    "droga":        "Healthcare",
    "saude":        "Healthcare",
    "hospital":     "Healthcare",
    "clinica":      "Healthcare",
    "tim":          "Bills & Utilities",
    "vivo":         "Bills & Utilities",
    "claro":        "Bills & Utilities",
    "energia":      "Bills & Utilities",
    "agua":         "Bills & Utilities",
    "light":        "Bills & Utilities",
    "iof":          "Bills & Utilities",
    "netflix":      "Entertainment",
    "spotify":      "Entertainment",
    "amazon":       "Entertainment",
    "cinema":       "Entertainment",
    "claude":       "Entertainment",
    "subscription": "Entertainment",
    "shopping":     "Shopping",
    "loja":         "Shopping",
    "magazine":     "Shopping",
    "renner":       "Shopping",
    "riachuelo":    "Shopping",
    "escola":       "Education",
    "curso":        "Education",
    "faculdade":    "Education",
    "universidade": "Education",
}

# ── Padrões de parcelas (3 formatos) ─────────────────────────
PARCELA_PATTERNS = [
    re.compile(r"[- ]*parcela\s+(\d+)/(\d+)", re.IGNORECASE),  # "Parcela X/Y"
    re.compile(r"\s+(\d{1,2})/(\d{1,2})\s*$"),                  # "NOME 02/12"
    re.compile(r"(?<=[A-Za-z*])(\d{2})/(\d{2})\s*$"),            # "NOME09/12"
]


def detectar_categoria(descricao: str) -> str:
    descricao_lower = descricao.lower()
    for keyword, category in CATEGORY_MAP.items():
        if keyword in descricao_lower:
            return category
    return "Other"


def processar_parcela(descricao: str) -> tuple[str, str, int, int, int]:
    for pattern in PARCELA_PATTERNS:
        match = pattern.search(descricao)
        if match:
            parcela_atual  = int(match.group(1))
            total_parcelas = int(match.group(2))
            if total_parcelas == 0 or parcela_atual > total_parcelas:
                continue
            duration        = max(1, total_parcelas - parcela_atual + 1)
            descricao_limpa = pattern.sub("", descricao).strip(" -").strip()
            if descricao_limpa:
                return descricao_limpa, "Monthly", duration, parcela_atual, total_parcelas
    return descricao, "One-time", 1, 0, 0


# ── Parser CSV do Nubank ──────────────────────────────────────

def parse_csv(conteudo: str) -> list[dict]:
    """
    Processa CSV do Nubank.
    Colunas esperadas: date, title, amount
    """
    df = pd.read_csv(StringIO(conteudo))
    df.columns = df.columns.str.strip().str.lower()

    required = {"date", "title", "amount"}
    if not required.issubset(set(df.columns)):
        raise ValueError(
            f"CSV inválido. Colunas esperadas: {required}. "
            f"Encontradas: {set(df.columns)}"
        )

    transacoes = []
    for _, row in df.iterrows():
        valor = abs(float(row["amount"]))
        if valor <= 0:
            continue

        descricao_raw = str(row["title"]).strip()
        data_raw      = str(row["date"]).strip()

        try:
            data = datetime.strptime(data_raw, "%Y-%m-%d").strftime("%Y-%m-%d")
        except ValueError:
            data = data_raw

        # ✅ Detecta parcelas
        descricao, frequency, duration, parcela_atual, total_parcelas = processar_parcela(descricao_raw)

        transacoes.append({
            "description":      descricao,
            "amount":           valor,
            "startDate":        data,
            "category":         detectar_categoria(descricao),
            "frequency":        frequency,
            "durationInMonths": duration,
            "installmentNumber":  parcela_atual,
            "totalInstallments":  total_parcelas,
            "paymentType":      "Cartão de Crédito",
            "paid":             False,
        })

    return transacoes


# ── Parser OFX do Nubank ──────────────────────────────────────

def parse_ofx(conteudo: str) -> list[dict]:
    """
    Processa OFX do Nubank (formato SGML).
    Extrai DTPOSTED, TRNAMT e MEMO de cada <STMTTRN>.
    """
    transacoes = []
    blocos = re.findall(r"<STMTTRN>(.*?)</STMTTRN>", conteudo, re.DOTALL)

    for bloco in blocos:
        dtposted = re.search(r"<DTPOSTED>(.*?)[\r\n<]", bloco)
        trnamt   = re.search(r"<TRNAMT>(.*?)[\r\n<]", bloco)
        memo     = re.search(r"<MEMO>(.*?)[\r\n<]", bloco)

        if not (dtposted and trnamt and memo):
            continue

        valor_raw = float(trnamt.group(1).strip())
        if valor_raw >= 0:
            continue  # ignora créditos/estornos

        valor         = abs(valor_raw)
        descricao_raw = memo.group(1).strip()

        data_raw = dtposted.group(1).strip()[:8]
        try:
            data = datetime.strptime(data_raw, "%Y%m%d").strftime("%Y-%m-%d")
        except ValueError:
            data = data_raw

        # ✅ Detecta parcelas
        descricao, frequency, duration, parcela_atual, total_parcelas = processar_parcela(descricao_raw)

        transacoes.append({
            "description":      descricao,
            "amount":           valor,
            "startDate":        data,
            "category":         detectar_categoria(descricao),
            "frequency":        frequency,
            "durationInMonths": duration,
            "installmentNumber":  parcela_atual,
            "totalInstallments":  total_parcelas,
            "paymentType":      "Cartão de Crédito",
            "paid":             False,
        })

    return transacoes


# ── Parser PDF do Itaú ───────────────────────────────────────

def parse_pdf_itau(pdf_bytes: bytes) -> list[dict]:
    """
    Processa PDF de fatura do Itaú (cartão de crédito).
    Lida com layout de duas colunas, linhas mescladas, Unicode e parcelas futuras.
    """
    # Lookahead: termina ao encontrar outra data, nova linha ou fim do texto
    TRANSACAO_RE = re.compile(
        r"@?(\d{2}/\d{2})\s+(.+?)\s+([\d]+(?:\.\d{3})*,\d{2})"
        r"(?=\s+@?\d{2}/\d{2}|\s*\n|\s*$)",
        re.MULTILINE,
    )
    # " +" evita consumir a quebra de linha anterior; \S* cobre Unicode (ç, ã, etc.)
    TOTAL_CARTAO_RE   = re.compile(r" +\S*\(final\d+\)\s+[\d.]+,\d{2}")
    MARKER_PARCELADAS = re.compile(r"[Cc]ompras\s*[Pp]arceladas")
    MARKER_PROXIMA    = re.compile(r"[Pp]r.{0,5}xima.{0,5}fatura\s+[\d.]+,\d{2}")

    transacoes: list[dict] = []

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        texto_total = "\n".join(p.extract_text() or "" for p in pdf.pages)

        ano_match = re.search(r"\b(20\d{2})\b", texto_total)
        ano = int(ano_match.group(1)) if ano_match else datetime.now().year

        # Remove linhas de totais por cartão que contêm "(finalXXXX)" para evitar
        # que o número do cartão seja capturado como valor de transação
        texto_limpo = TOTAL_CARTAO_RE.sub("", texto_total)

        # ── Divide o texto em 3 regiões ──────────────────────────────────────
        # R1: transações correntes antes do bloco de parcelas futuras
        # R2: bloco de parcelas futuras → manter apenas transações One-time
        #     (o layout de 2 colunas pode misturar a última linha de R1 com R2)
        # R3: transações do segundo cartão (após "Próxima fatura R$ X")
        m_parceladas = MARKER_PARCELADAS.search(texto_limpo)
        pos_p = m_parceladas.start() if m_parceladas else len(texto_limpo)

        pos_q = len(texto_limpo)
        if m_parceladas:
            for m in MARKER_PROXIMA.finditer(texto_limpo, pos_p):
                pos_q = m.start()
                break

        region1 = texto_limpo[:pos_p]
        region2 = texto_limpo[pos_p:pos_q] if pos_p < pos_q else ""
        region3 = texto_limpo[pos_q:]      if pos_q < len(texto_limpo) else ""

        def extrair_transacoes(texto: str, apenas_onetime: bool = False) -> None:
            for match in TRANSACAO_RE.finditer(texto):
                data_raw, descricao_raw, valor_raw = match.groups()
                try:
                    valor = float(valor_raw.replace(".", "").replace(",", "."))
                except ValueError:
                    continue
                if valor <= 0:
                    continue
                try:
                    data = datetime.strptime(
                        f"{data_raw}/{ano}", "%d/%m/%Y"
                    ).strftime("%Y-%m-%d")
                except ValueError:
                    continue
                descricao, frequency, duration, parcela_atual, total_parcelas = processar_parcela(descricao_raw.strip())
                if apenas_onetime and frequency != "One-time":
                    continue
                transacoes.append({
                    "description":      descricao,
                    "amount":           valor,
                    "startDate":        data,
                    "category":         detectar_categoria(descricao),
                    "frequency":        frequency,
                    "durationInMonths": duration,
                    "installmentNumber":  parcela_atual,
                    "totalInstallments":  total_parcelas,
                    "paymentType":      "Cartão de Crédito",
                    "paid":             False,
                })

        extrair_transacoes(region1)
        extrair_transacoes(region2, apenas_onetime=True)
        extrair_transacoes(region3)

    return transacoes


# ── Endpoint principal ────────────────────────────────────────

@app.route("/processar-extrato", methods=["POST"])
@limiter.limit("60 per minute")
def processar_extrato():
    if "file" not in request.files:
        return jsonify({"erro": "Nenhum arquivo enviado. Use o campo 'file'."}), 400

    arquivo = request.files["file"]
    nome    = arquivo.filename.lower()

    if not nome:
        return jsonify({"erro": "Nome do arquivo inválido."}), 400

    try:
        raw_bytes = arquivo.read()

        if nome.endswith(".pdf"):
            transacoes = parse_pdf_itau(raw_bytes)
        elif nome.endswith(".csv"):
            transacoes = parse_csv(raw_bytes.decode("utf-8", errors="replace"))
        elif nome.endswith(".ofx"):
            transacoes = parse_ofx(raw_bytes.decode("utf-8", errors="replace"))
        else:
            return jsonify({"erro": "Formato não suportado. Envie CSV, OFX ou PDF."}), 400

        return jsonify({
            "total":      len(transacoes),
            "transacoes": transacoes,
        }), 200

    except ValueError as e:
        return jsonify({"erro": str(e)}), 422
    except Exception as e:
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500


# ── Health check ──────────────────────────────────────────────

@app.route("/health", methods=["GET"])
@limiter.exempt
def health():
    return jsonify({"status": "ok"}), 200


# ── Entry point ───────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)