# Model Prices

Visualizador de preços de modelos de IA com suporte a múltiplos provedores e moedas.

## Demonstração

| Chart | Lista |
|-------|-------|
| ![Chart](public/screenshots/chart-v2.png) | ![List](public/screenshots/list-v2.png) |

| Comparação |
|------------|
| ![Compare](public/screenshots/compare-demo-v2.png) |

## Estrutura do Projeto

```
├── .gitignore
├── package.json
├── server.js
├── commits/
│   └── commit-*.md
├── node_modules/
└── public/
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   └── script.js
    └── screenshots/
        ├── chart-v2.png
        ├── list-v2.png
        └── compare-demo-v2.png
```

## Scripts

| Script | Descrição |
|--------|-----------|
| `server.js` | Servidor Express que serve a aplicação e as APIs de dados |

## Endpoints da API

- `GET /api/prices` - Retorna os preços dos modelos
- `GET /api/rates` - Retorna as taxas de câmbio
