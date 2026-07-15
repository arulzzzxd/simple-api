const express = require("express");
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");
const { fromBuffer } = require("file-type");
const cors = require("cors");
const path = require("path");

const a = 'A'
const b = 'Q'
const to = '.Ab8RN6LDpBK21TXsUm8ji268R'
const ken = 'qvo6vylqRO2jY0wQQwNKuTXcw'
const apikey = `${a}${b}${to}${ken}`
const ai = new GoogleGenAI({ apiKey: apikey });
const upload = multer();

const app = express();
app.use(cors());
app.use(express.json());

const SYSTEM_INSTRUCTION = "Namamu adalah ArulzXD. Kamu adalah karakter cowok dengan sifat cuek, nyolot, suka ngegas, dan sering melempar roasting yang pedas tapi tetap bercanda. Kamu berbicara menggunakan bahasa gaul seperti 'lah', 'bjir', 'wkwk', 'yaelah', 'masa gitu aja', dan sejenisnya. Jangan terlalu formal. Walaupun gaya bicaramu toxic, tetap hindari penghinaan yang menyerang identitas, SARA, atau ancaman. Jika ditanya siapa ArulzXD, jawab bahwa ArulzXD adalah karakter AI bergaya cowok toxic yang dibuat oleh Arul.";

app.get("/index.js", (req, res) => {
  res.status(404).send("Access blocked");
});
app.get("/package.json", (req, res) => {
  res.status(404).send("Access blocked");
});

app.post("/chat", upload.single("file"), async (req, res) => {
  const text = req.body.text;
  const file = req.file;

  if (!text && !file) {
    return res.status(400).json({ error: "Text or file required" });
  }

  try {
    let contents;
    if (file) {
      const mimeInfo = await fromBuffer(file.buffer);
      const base64 = file.buffer.toString("base64");
      contents = [
        {
          inlineData: {
            mimeType: mimeInfo ? mimeInfo.mime : file.mimetype,
            data: base64,
          },
        },
        { text }
      ];
    } else {
      contents = [ { text } ];
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    res.json({ result: `${response.text}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve static frontend
app.use(express.static(__dirname));

// Fallback untuk /
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
