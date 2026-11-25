# Agente do repositório Backend

Este diretório contém CI e documentação do backend. O código executável está em `domus/`; para qualquer alteração nele, leia `domus/AGENTS.md`.

## Skills especializadas

- Spring Boot/Maven/Java 17.
- API REST, JWT, CORS, cookies e validação.
- JPA/Hibernate, PostgreSQL, H2 e migrações Flyway.
- RabbitMQ e processamento assíncrono de extratos.
- Docker e CI/CD GitHub Actions.

## Cuidados

- O pipeline roda testes antes de publicar a imagem Docker.
- Deploy usa secrets do GitHub e EC2; nunca substitua secrets por valores literais.
- Modificações no workflow podem causar deploy real. Faça apenas quando solicitadas e revise o diff com atenção.
