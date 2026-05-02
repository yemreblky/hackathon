// 1. BÖLÜM: JÜRİNİN İSTEDİĞİ BIOS-FİT MATEMATİĞİ (SKORLAMA)
function calculateBiosFitScore(aiJson, sourceUrl) {
    // --- E: Olay Tipi (Ağırlık: %30) ---
    let E = 0.10; // Varsayılan "other"
    const eventType = aiJson.event_type ? aiJson.event_type.toLowerCase() : "";
    if (eventType === "relocation") E = 1.00;
    else if (eventType === "new_plant") E = 0.90;
    else if (eventType === "expansion") E = 0.75;
    else if (eventType === "tender") E = 0.55;
    else if (eventType === "closure") E = 0.45;

    // --- A: Aktör Netliği (Ağırlık: %25) ---
    let A = 0.0;
    if (aiJson.company && aiJson.company !== "null") A += 0.40;
    if (aiJson.from_location && aiJson.from_location !== "null") A += 0.25;
    if (aiJson.to_location && aiJson.to_location !== "null") A += 0.25;
    if (aiJson.sector && aiJson.sector !== "null") A += 0.10;

    // --- G: Coğrafya (Ağırlık: %20) ---
    let G = 0.30; // Varsayılan: Bilinmiyor
    const locations = (aiJson.from_location + " " + aiJson.to_location).toLowerCase();
    const avrupaKelimeleri = ["türkiye", "almanya", "fransa", "avrupa", "ingiltere", "italya", "ispanya", "polonya", "romanya"];
    
    if (avrupaKelimeleri.some(ulke => locations.includes(ulke))) {
        G = 1.00; // Avrupa içi
    } else if (locations.length > 5 && !locations.includes("null")) {
        G = 0.10; // Avrupa dışı
    }

    // --- T: Zaman Penceresi (Ağırlık: %15) ---
    let T = 0.30; // Varsayılan "Belirtilmemiş"

    // --- C: Kaynak Güveni (Ağırlık: %10) ---
    let C = 0.55; // Varsayılan genel haber sitesi
    const url = sourceUrl.toLowerCase();
    if (url.includes("reuters") || url.includes("bloomberg") || url.includes("ft.com")) C = 0.85;
    else if (url.includes("industryweek") || url.includes("manufacturing")) C = 0.70;

    // --- FİNAL SKORU HESAPLAMA ---
    let rawScore = 100 * (0.30 * E + 0.25 * A + 0.20 * G + 0.15 * T + 0.10 * C);

    // Güven (Confidence) Puanı ve Ceza
    let filledFields = 0;
    if (aiJson.company && aiJson.company !== "null") filledFields++;
    if (aiJson.from_location && aiJson.from_location !== "null") filledFields++;
    if (aiJson.to_location && aiJson.to_location !== "null") filledFields++;
    if (aiJson.sector && aiJson.sector !== "null") filledFields++;
    if (aiJson.event_type && aiJson.event_type !== "null") filledFields++;

    let confidence = filledFields / 5;
    if (confidence < 0.40) rawScore = rawScore * 0.5; // Veri çok eksikse puanı yarıya düşür

    return {
        ...aiJson,                    // AI'dan gelen verileri koru (Şirket, sektör vb.)
        score: Math.round(rawScore),  // Puanı yuvarlayarak ekle
        confidence: confidence,       // Güven oranını ekle
        source_url: sourceUrl
    };
}

// 2. BÖLÜM: YAPAY ZEKA API BAĞLANTISI (OLLAMA)
async function haberiIsle(haberMetni, sourceUrl) {
    console.log("Yapay Zeka (euro-radar) haberi okuyor. Lütfen bekleyin...");
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "euro-radar", // Senin oluşturduğun süper model
                prompt: `METİN: ${haberMetni}`,
                format: "json",      // DİKKAT: Modelin gevezelik etmesini bu satır engeller!
                stream: false        
            })
        });

        const data = await response.json();
        const aiJson = JSON.parse(data.response); // AI'dan gelen ham JSON
        
        // AI'dan JSON'ı aldık, şimdi kendi matematik fonksiyonumuza sokup puanlıyoruz
        const finalData = calculateBiosFitScore(aiJson, sourceUrl);
        
        return finalData;

    } catch (error) {
        console.error("İşlem hatası:", error);
        return null;
    }
}

// 3. BÖLÜM: TEST ÇALIŞTIRMASI
async function testiBaslat() {
    // Yapay zekaya test için vereceğimiz haber metni ve sahte link
    const ornekHaber = "Volkswagen, artan enerji maliyetleri nedeniyle Almanya'daki motor fabrikasını kapatarak tüm üretimi Polonya'ya taşıyacağını duyurdu.";
    const ornekKaynak = "https://www.reuters.com/business/autos-transportation/vw-news";

    const sonuc = await haberiIsle(ornekHaber, ornekKaynak);
    
    console.log("\n--- JÜRİYE SUNULACAK FİNAL VERİ ---");
    console.log(sonuc);
    console.log("-----------------------------------");
}

// Kodu çalıştıran komut
testiBaslat();
