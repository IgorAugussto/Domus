# Agente da API Spring Boot

## Stack e comandos

- Java 17, Spring Boot 3.5, Maven Wrapper, Spring Security, JPA/Hibernate, PostgreSQL, Flyway e RabbitMQ.
- Rode `./mvnw clean verify` antes de concluir alterações Java; use `./mvnw test` para ciclos rápidos.
- O Dockerfile expõe HTTPS na porta 8443 e produz o jar em `target/`.

## Skills especializadas

- API por domínio: controllers em `controller/`, casos de uso em `service/`, persistência em `repository/`, entidades em `entity/`, contratos em `dto/`.
- Segurança: `SecurityConfig`, `JwtAuthenticationFilter`, `JwtService`, cookies seguros, CORS e autorização por usuário.
- Persistência: entidades e repositories devem respeitar ownership do usuário; alterações de schema entram em `src/main/resources/db/migration/` com versão Flyway nova.
- Mensageria: `messaging/` e `RabbitMQConfig` integram importação de extratos; preserve idempotência e estados de `ImportJob`.
- Testes: controllers/services usam Spring Test, segurança e H2; novos comportamentos devem ter teste de sucesso e falha relevante.

## Regras de domínio e segurança

- Não use `ddl-auto: update/create` como solução; o schema é de responsabilidade do Flyway.
- Não logue JWT, senhas, arquivos de extrato ou credenciais. Não altere `.env` ou configurações de produção para “fazer o teste passar”.
- Endpoints protegidos devem validar o usuário autenticado e impedir acesso a registros de outro usuário.
- Preserve os contratos usados por web, desktop e mobile: `/api/auth`, `/api/dashboard`, `/api/income`, `/api/costs`, `/api/investments`, pagamentos, cartões e importação.
- Ao mudar DTO, enum, status ou formato de data, procure todos os services TypeScript consumidores.
- `application-prod.yml` usa keystore PKCS12, Supabase e RabbitMQ por variáveis; nunca embuta valores secretos.
