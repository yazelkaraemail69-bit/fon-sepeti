# 📊 Fon Sepeti Optimizasyonu

TEFAS yatırım fonlarınızı analiz edip **daha az fonla daha verimli sepetler** öneren web uygulaması.

## Özellikler

- **3 veri kaynağı:**
  1. 🌐 **Canlı TEFAS** — fon kodlarını girin, veriler TEFAS'tan çekilmeye çalışılır (TEFAS bot koruması nedeniyle engellenebilir)
  2. 📁 **CSV Yükleme** — TEFAS "Tarihsel Veriler" dışa aktarımlarını veya `tarih,kod,fiyat` formatındaki dosyaları yükleyin (en güvenilir yöntem)
  3. 🔗 **URL'den Çekme** — CSV/JSON döndüren herhangi bir adresten veri çekin
- **Fon karşılaştırması:** dönem getirisi, yıllıklandırılmış getiri, volatilite, Sharpe oranı, maksimum düşüş
- **Korelasyon matrisi:** hangi fonların aynı hareket ettiğini görün
- **Gereksiz fon tespiti:** %90+ korelasyonlu çiftlerden hangisinin çıkarılabileceği önerisi
- **Portföy optimizasyonu:** Monte Carlo + yerel arama ile Sharpe'ı maksimize eden ağırlıklar; 4/6/8 fonluk optimal alt sepet önerileri
- **🤖 AI Değerlendirmesi:** OpenRouter (Gemini) ile Türkçe portföy yorumu

## Kurulum

```bash
npm install
```

`.env.local` dosyasına OpenRouter anahtarınızı ekleyin:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

## Çalıştırma

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın.

## CSV Formatı

TEFAS dışa aktarımı (noktalı virgül ayraçlı):

```
Tarih;Fon Kodu;Fon Adı;Fiyat
02.01.2025;TTE;İŞ PORTFÖY TEKNOLOJİ...;5,123456
```

veya basit format:

```
tarih,kod,fiyat
2025-01-02,TTE,5.123456
```

Her fon için **en az 30 günlük** veri gerekir. Birden fazla dosya yüklenebilir.

## Nasıl Çalışır?

1. Fiyat serilerinden günlük getiriler hesaplanır (ortak tarihler hizalanır)
2. Her fon için getiri/risk metrikleri ve fonlar arası korelasyon/kovaryans matrisi çıkarılır
3. Greedy geri eleme ile hedef fon sayısına inilir; her adımda Sharpe'ı en az düşüren fon çıkarılır
4. Kalan fonlar için Monte Carlo + yerel iyileştirme ile optimal ağırlıklar bulunur
5. Sharpe hesabında yıllık ~%40 risksiz getiri (TR mevduat ortalaması) varsayılır — `src/lib/analytics.ts` içinden değiştirilebilir

## Uyarı

Bu araç yalnızca bilgilendirme amaçlıdır, **yatırım tavsiyesi değildir**. Geçmiş performans gelecekteki getirilerin garantisi değildir.
