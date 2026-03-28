const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// ======================= AI MESSAGE ID =======================
function gerarAIMessageId() {
  const numero = Math.floor(Math.random() * 21) + 10;
  return `aimsg_${numero}kkyt3zepecssbne14fzpxjzz`;
}

// ======================= ENDPOINT /send =======================
app.post('/send', upload.single('file'), async (req, res) => {
  const { token, projectId, message = '' } = req.body;
  const file = req.file;

  if (!token || !projectId) {
    return res.status(400).json({ success: false, error: 'token e projectId são obrigatórios' });
  }

  let filesArray = [];
  let optimisticImageUrls = [];

  // ==================== UPLOAD DE IMAGEM ====================
  if (file) {
    try {
      // 1. Gerar Upload URL
      const uploadRes = await fetch('https://api.lovable.dev/files/generate-upload-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://lovable.dev'
        },
        body: JSON.stringify({
          file_name: file.originalname || `image_${Date.now()}.webp`,
          content_type: file.mimetype
        })
      });
      const uploadData = await uploadRes.json();

      // 2. Fazer upload da imagem
      await fetch(uploadData.url, {
        method: 'PUT',
        body: file.buffer
      });

      // 3. Gerar Download URL
      const downloadRes = await fetch('https://api.lovable.dev/files/generate-download-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://lovable.dev'
        },
        body: JSON.stringify({
          dir_name: uploadData.url.split('/').slice(-2, -1)[0],
          file_name: uploadData.url.split('/').pop().split('?')[0]
        })
      });
      const downloadData = await downloadRes.json();

      const fileId = uploadData.url.split('/').pop().split('?')[0];

      filesArray = [{
        file_id: fileId,
        file_name: file.originalname || 'imagem.webp',
        type: "user_upload"
      }];

      optimisticImageUrls = [downloadData.url];

    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro no upload da imagem: ' + err.message });
    }
  }

  // ======================= PAYLOAD FINAL =======================
  const payload = {
    id: `umsg_${Math.random().toString(36).slice(2, 15)}`,
    message: message + " e Checkar Segurança do App",
    intent: 'security_chat',
    chat_only: false,
    ai_message_id: gerarAIMessageId(),
    thread_id: 'main',
    view: 'security',
    view_description: 'The user is currently viewing the preview.',
    optimisticImageUrls: optimisticImageUrls,
    files: filesArray,
    selected_elements: [],
    model: null,
    session_replay: '[]',
    client_logs: [],
    network_requests: [],
    runtime_errors: [],
    integration_metadata: {
      browser: {
        preview_viewport_width: 1311,
        preview_viewport_height: 895,
        is_logged_out: false
      }
    }
  };

  try {
    const chatRes = await fetch(`https://api.lovable.dev/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Origin': 'https://lovable.dev'
      },
      body: JSON.stringify(payload)
    });

    const raw = await chatRes.text();
    let data = {};
    try { data = JSON.parse(raw); } catch {}

    res.json({
      success: true,
      message: '✅ Prompt enviado com sucesso!',
      hasImage: !!file,
      ai_message_id_usado: payload.ai_message_id,
      lovableResponse: data
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================= DOCUMENTAÇÃO =======================
app.get('/docs', (req, res) => {
  res.send(`<h1>API com Upload de Imagem - Funcionando</h1>`);
});

app.get('/', (req, res) => res.redirect('/docs'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ API rodando'));
