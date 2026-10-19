# Sartec CRM — evidências visuais: guia de captura (CK21)

Pasta reservada para as capturas e vídeos **reais** do CRM e do agente de WhatsApp que o case Sartec ainda não mostra.
Hoje ela está **vazia de propósito**: nenhum arquivo daqui está publicado, referenciado ou substituído por reconstrução.
Este `.md` não vai para o deploy (`.vercelignore` exclui `*.md`).

```
assets/cases/sartec/crm/media/
├── screenshots/   ← .webp (as telas)
└── videos/        ← .mp4 (opcional, fluxos curtos)
```

O Git não guarda pastas vazias: elas existem na máquina e passam a existir no repositório quando o primeiro arquivo aprovado entrar.
O `.gitignore` só deixa entrar `.webp` em `screenshots/` e `.mp4` em `videos/`; PNG, MOV, projetos de edição e qualquer arquivo "bruto" ficam de fora.

## 1. Auditoria — o que existe hoje

| Arquivo | Onde está | Conteúdo | Situação |
|---|---|---|---|
| `assets/cases/sartec/crm/quem-esta-atendendo.webp` | versionado, publicado | Janela "Quem está atendendo agora?": só primeiros nomes da equipe e iniciais, sem cliente, sem telefone, sem conversa | **Seguro** — única captura real do CRM no site (Home e case, bloco B) |
| `assets/cases/sartec/brand/sartec-logo.png` | versionado, publicado | Logotipo da empresa | Seguro (marca, não é tela do produto) |
| `CRM sartec.mp4`, `video crm sartec - portifolio.mp4` | raiz do projeto, **ignorados** (`.gitignore` + `.vercelignore`) | Gravações do CRM com nomes, telefones e conversas de clientes (incidente CK16) | **Proibidos.** Não reutilizar, não recortar, não desfocar, não reintroduzir |
| `video site sartec digital - portifólio.mp4`, `video site sartec papelaria - portifolio.mp4`, `PROTÓTIPO-SITE SARTEC.mp4`, `sartec digital - portifolio.png`, `assets/cases/sites/sartec-papelaria-inicio.jpg` | versionados | Sites da Sartec (papelaria / digital), não o CRM | Não servem como evidência do CRM |

Reconstruções que hoje ocupam o lugar das telas reais no case (`cases/sartec/index.html`), já sinalizadas como tal:

- bloco A — quadro Kanban (`.board`), "reconstruído a partir de uma captura real, sem dados";
- bloco C — histórico (`.hist`), "exemplo ilustrativo";
- bloco D — estados da janela de 24 h (`.wstates`), diagrama;
- mobile e triagem/handoff do agente — apenas texto.

Não há, até aqui, ambiente de demonstração com dados fictícios identificado nem autorizado, e nada foi capturado automaticamente.

## 2. Nomes reservados

Capturas (`screenshots/`):

| Arquivo | Deve mostrar | Entra no case em |
|---|---|---|
| `sartec-crm-overview-desktop.webp` | O quadro completo (abas PF/PJ, colunas, cards com responsável e estado) | bloco A, no lugar da reconstrução |
| `sartec-crm-attendance-detail.webp` | Um atendimento aberto: responsável, estado, prioridade, janela de 24 h | bloco D |
| `sartec-crm-history.webp` | Histórico com mensagem do cliente, áudio transcrito e template de retomada como evento | bloco C, no lugar do exemplo ilustrativo |
| `sartec-crm-mobile.webp` | O chat em tela única no celular, com ações rápidas | seção Implantação (mobile) |
| `sartec-agent-whatsapp-triage.webp` | Conversa de triagem do agente e a passagem para uma pessoa (handoff) | seção do agente |

Vídeos opcionais (`videos/`): `sartec-crm-workflow-demo.mp4` (fluxo: assumir → responder → resolver) e `sartec-agent-handoff-demo.mp4` (IA → humano, com o contexto indo junto).

Só entra o que existe no produto real. Se uma tela ainda não existe, o case continua com o texto ou a reconstrução sinalizada.

## 3. Privacidade — obrigatório antes de qualquer arquivo entrar

O portfólio já teve vídeos do CRM com clientes reais. Por isso:

1. **Fonte limpa, não arquivo "limpo depois".** Capture num ambiente de demonstração isolado, com dados fictícios criados para isso (conta, banco e número de teste separados da produção). Não abra conta, conversa ou número de cliente real para obter uma tela.
2. **Nada de camuflagem na exibição.** Crop por CSS, blur por CSS, retângulo por cima, `object-position`, máscara: nada disso protege, porque o arquivo original continua servido inteiro. O que está no arquivo é o que o mundo vê.
3. **Revise o arquivo final, em tamanho real**, procurando: nomes, telefones, e-mails, avatares e fotos, texto de mensagens, valores e pedidos, notificações do sistema operacional, abas do navegador, barra de favoritos, relógio/bateria com dados pessoais, URL com ID de cliente, miniaturas de arquivos.
4. **Metadados.** Exportar sem EXIF/XMP (`cwebp -metadata none`; para vídeo, `-map_metadata -1`). Conferir com `exiftool arquivo`.
5. **Nenhum arquivo bruto no Git**, nem em commit temporário (PNG original, gravação de tela, projeto de edição). Só o `.webp`/`.mp4` final.
6. Os arquivos removidos no CK16 não voltam, em nenhuma forma.
7. Quem aprova é a pessoa responsável pelo produto, com o arquivo final aberto, antes do commit.

## 4. Direção de mídia

**Desktop** — viewport 1440 × 900 (ou equivalente), WebP nítido (`-q 88`). Tela inteira quando a arquitetura é o ponto; recorte só para detalhe, e o recorte é feito na exportação (pixels removidos do arquivo), não no CSS.

**Mobile** — 390 × 844 em 2x (780 × 1688), preservando a proporção real. A moldura de celular é HTML/CSS que o site já tem (`.device-screen`, `home.css`): a imagem entra inteira dentro dela.

**Vídeo** — MP4 H.264, 24–30 fps, **sem áudio**, 8–20 s, idealmente 1–3 MB por clipe, mostrando uma decisão ou um fluxo concreto. Na página: `muted loop playsinline preload="none"`, carregado só quando visível (como `video.lazy-video`), parado com `prefers-reduced-motion` e com pôster estático. Nada de autoplay com som.

Comandos de referência:

```bash
# captura → WebP (desktop)
cwebp -q 88 -m 6 -sharp_yuv -metadata none entrada.png -o sartec-crm-overview-desktop.webp

# gravação → MP4 leve, sem áudio, sem metadados, pronto para streaming
ffmpeg -i gravacao.mov -an -map_metadata -1 -vf "fps=30,scale=1280:-2" \
  -c:v libx264 -profile:v high -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart \
  sartec-crm-workflow-demo.mp4
```

## 5. O que falta para a próxima rodada

- Um ambiente de demonstração do CRM com dados fictícios (ou autorização explícita para montar um) — sem isso, nenhuma tela abaixo pode ser capturada.
- As cinco capturas da seção 2 e, se fizerem sentido, os dois vídeos.
- Aprovação de privacidade arquivo por arquivo (seção 3).
- Depois disso, a integração é pequena: trocar as reconstruções A e C por `<img>` com `width`/`height` reais e texto alternativo nos três idiomas (`cases/sartec/i18n.js` e `i18n.es.js`), atualizar as legendas ("Captura real") e remover o aviso "Telas completas, ainda não" do bloco de status.
