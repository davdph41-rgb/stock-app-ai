// Vercel Serverless Function: AI receipt image reader
// Set GEMINI_API_KEY in Vercel Project Settings > Environment Variables.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Vercel.' });

  try {
    const { base64, mimeType, menuNames } = req.body || {};
    if (!base64 || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return res.status(400).json({ error: 'Foto nota tidak valid.' });
    }
    if (typeof base64 !== 'string' || base64.length > 4_000_000) {
      return res.status(413).json({ error: 'Ukuran foto terlalu besar. Gunakan foto yang lebih kecil.' });
    }
    const allowedMenus = Array.isArray(menuNames) ? menuNames.slice(0, 40).map(String) : [];
    const prompt = `
Kamu adalah pembaca nota kasir. Baca gambar nota dengan teliti.
Keluarkan HANYA JSON valid dengan struktur:
{
  "receiptDate": "YYYY-MM-DD atau null",
  "receiptTime": "HH:mm 24 jam atau null",
  "items": [{"menu":"nama menu yang tertulis","quantity":jumlah_integer}]
}
Aturan:
- Ambil tanggal dan jam dari waktu transaksi/printed timestamp pada nota, bukan jam saat ini.
- Jika tanggal tidak tercetak atau tidak terbaca, receiptDate harus null.
- Jika jam tidak tercetak atau tidak terbaca, receiptTime harus null.
- Jangan menebak angka yang buram. Jika item/jumlah tidak terbaca, jangan masukkan item itu.
- Daftar nama menu yang dikenal aplikasi: ${JSON.stringify(allowedMenus)}.
- Pertahankan nama menu yang terbaca; jangan mengganti item dengan menu yang tidak ada di daftar.
- Abaikan harga, subtotal, pajak, total rupiah, nomor meja, dan nomor transaksi.
- Jika nota berisi total kuantitas per item, gunakan kuantitas tersebut satu kali.
- Jangan mengarang data dan jangan menambahkan penjelasan di luar JSON.
`;
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]}],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 }
      })
    });
    const payload = await geminiResponse.json();
    if (!geminiResponse.ok) {
      console.error('Gemini API error:', payload);
      return res.status(502).json({ error: 'Gemini gagal membaca nota. Periksa API Key atau coba lagi.' });
    }
    const output = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!output) return res.status(502).json({ error: 'AI tidak menghasilkan pembacaan nota.' });
    let parsed;
    try { parsed = JSON.parse(output); }
    catch { return res.status(502).json({ error: 'Hasil AI tidak berbentuk JSON yang valid.' }); }

    const timeMatch = typeof parsed.receiptTime === 'string' && parsed.receiptTime.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    const dateMatch = typeof parsed.receiptDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.receiptDate);
    const items = Array.isArray(parsed.items) ? parsed.items.map(item => ({
      menu: String(item.menu || '').slice(0, 100),
      quantity: Math.floor(Number(item.quantity))
    })).filter(item => item.menu && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 10000) : [];
    return res.status(200).json({
      receiptDate: dateMatch ? parsed.receiptDate : null,
      receiptTime: timeMatch ? `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}` : null,
      items
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses nota.' });
  }
}
