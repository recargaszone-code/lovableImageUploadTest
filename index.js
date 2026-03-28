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

  if (file) {
    try {
      // === GERA NOME ÚNICO A CADA UPLOAD ===
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const extension = file.originalname ? file.originalname.split('.').pop() : 'jpg';
      const uniqueFileName = `image_${timestamp}_${randomStr}.${extension}`;

      console.log('Enviando imagem com nome único:', uniqueFileName);

      // 1. Gerar Upload URL
      const uploadRes = await fetch('https://api.lovable.dev/files/generate-upload-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://lovable.dev'
        },
        body: JSON.stringify({
          file_name: uniqueFileName,
          content_type: file.mimetype || 'image/jpeg'
        })
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Generate upload URL falhou: ${uploadRes.status} - ${errText}`);
      }

      const uploadData = await uploadRes.json();
      const uploadUrl = uploadData.url;

      if (!uploadUrl || !uploadUrl.startsWith('http')) {
        throw new Error('URL de upload inválida');
      }

      // 2. Fazer upload real
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file.buffer,
        headers: { 'Content-Type': file.mimetype || 'image/jpeg' }
      });

      if (!putRes.ok) {
        throw new Error(`Upload para storage falhou: ${putRes.status}`);
      }

      // 3. Gerar Download URL
      const downloadRes = await fetch('https://api.lovable.dev/files/generate-download-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://lovable.dev'
        },
        body: JSON.stringify({
          dir_name: uploadUrl.split('/').slice(-2, -1)[0],
          file_name: uniqueFileName
        })
      });

      if (!downloadRes.ok) {
        const errText = await downloadRes.text();
        throw new Error(`Generate download URL falhou: ${downloadRes.status}`);
      }

      const downloadData = await downloadRes.json();

      filesArray = [{
        file_id: uniqueFileName,
        file_name: file.originalname || uniqueFileName,
        type: "user_upload"
      }];

      optimisticImageUrls = [downloadData.url];

      console.log('✅ Imagem enviada com sucesso. Novo file_id:', uniqueFileName);

    } catch (err) {
      console.error('Erro no upload:', err.message);
      return res.status(500).json({ success: false, error: 'Erro ao fazer upload da imagem: ' + err.message });
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
    res.status(500).json({ success: false, error: 'Erro ao enviar prompt: ' + err.message });
  }
});

app.get('/', (req, res) => res.redirect('/docs'));
app.get('/docs', (req, res) => res.send('<h1>API Lovable - Upload com Nome Único</h1>'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ API rodando'));
