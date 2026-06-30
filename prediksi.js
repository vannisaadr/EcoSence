// Fungsi memuat data Supabase khusus halaman prediksi
async function ambilDataHistoris() {
    try {
        let semuaDataHistoris = [];
        let batasAwal = 0;
        const limitPerTarik = 1000;
        let masihAdaData = true;
        const MAKSIMAL_DATA = 30000; // Pembatasan data aman untuk browser

        while (masihAdaData && batasAwal < MAKSIMAL_DATA) {
            const { data, error } = await db
                .from('monitoring_suhu')
                .select('suhu, kelembapan, created_at')
                .order('created_at', { ascending: false })
                .range(batasAwal, batasAwal + limitPerTarik - 1);

            if (error) throw error;
            semuaDataHistoris = semuaDataHistoris.concat(data);

            if (data.length < limitPerTarik) masihAdaData = false;
            batasAwal += limitPerTarik;
        }

        if (semuaDataHistoris.length > 0) {
            jalankanKomparasiAI(semuaDataHistoris);
        } else {
            document.getElementById('teks-kesimpulan').innerText = "Data tidak ditemukan di database.";
        }

    } catch (err) {
        console.error("Gagal memuat data prediksi:", err);
        document.getElementById('teks-kesimpulan').innerText = "Gagal memproses AI karena galat koneksi database.";
    }
}

function jalankanKomparasiAI(dataHistoris) {
    const jamSekarang = new Date().getHours();

    // ==========================================
    // METODE 1: LINEAR REGRESSION (ALGORITMA 1)
    // ==========================================
    let n = dataHistoris.length;
    let sumX = 0, sumY_suhu = 0, sumY_lembab = 0;
    let sumXY_suhu = 0, sumXY_lembab = 0, sumXX = 0;

    dataHistoris.forEach(row => {
        const x = new Date(row.created_at).getHours();
        const y_suhu = parseFloat(row.suhu);
        const y_lembab = parseFloat(row.kelembapan);

        sumX += x;
        sumXX += x * x;
        sumY_suhu += y_suhu;
        sumXY_suhu += x * y_suhu;
        sumY_lembab += y_lembab;
        sumXY_lembab += x * y_lembab;
    });

    const slopeSuhu = (n * sumXY_suhu - sumX * sumY_suhu) / (n * sumXX - sumX * sumX);
    const slopeLembab = (n * sumXY_lembab - sumX * sumY_lembab) / (n * sumXX - sumX * sumX);
    const interceptSuhu = (sumY_suhu - slopeSuhu * sumX) / n;
    const interceptLembab = (sumY_lembab - slopeLembab * sumX) / n;

    let lrSuhu = parseFloat((slopeSuhu * jamSekarang + interceptSuhu).toFixed(1));
    let lrLembab = parseFloat((slopeLembab * jamSekarang + interceptLembab).toFixed(1));

    // Fallback jika hasil tak valid
    if (isNaN(lrSuhu)) {
        lrSuhu = parseFloat(dataHistoris[0].suhu);
        lrLembab = parseFloat(dataHistoris[0].kelembapan);
    }

    // ==========================================
    // METODE 2: DECISION TREE REGRESSION (ALGORITMA 2)
    // ==========================================
    let nodePagi = [], nodeSiang = [], nodeSore = [], nodeMalam = [];

    dataHistoris.forEach(row => {
        const jam = new Date(row.created_at).getHours();
        const s = parseFloat(row.suhu);
        const l = parseFloat(row.kelembapan);

        // Aturan Split Berdasarkan Jam
        if (jam >= 1 && jam <= 10) nodePagi.push({s, l});
        else if (jam >= 11 && jam <= 14) nodeSiang.push({s, l});
        else if (jam >= 15 && jam <= 18) nodeSore.push({s, l});
        else nodeMalam.push({s, l});
    });

    const hitungRataNode = (node) => {
        if(node.length === 0) return { s: parseFloat(dataHistoris[0].suhu), l: parseFloat(dataHistoris[0].kelembapan) };
        const totalSuhu = node.reduce((acc, curr) => acc + curr.s, 0);
        const totalLembab = node.reduce((acc, curr) => acc + curr.l, 0);
        return { s: parseFloat((totalSuhu / node.length).toFixed(1)), l: parseFloat((totalLembab / node.length).toFixed(1)) };
    };

    let dtHasil;
    let kategoriWaktu = "";
    let sampelNode = 0;

    if (jamSekarang >= 1 && jamSekarang <= 10) {
        dtHasil = hitungRataNode(nodePagi);
        kategoriWaktu = "Pagi (01:00 - 10:00)";
        sampelNode = nodePagi.length;
    } else if (jamSekarang >= 11 && jamSekarang <= 14) {
        dtHasil = hitungRataNode(nodeSiang);
        kategoriWaktu = "Siang (11:00 - 14:00)";
        sampelNode = nodeSiang.length;
    } else if (jamSekarang >= 15 && jamSekarang <= 18) {
        dtHasil = hitungRataNode(nodeSore);
        kategoriWaktu = "Sore (15:00 - 18:00)";
        sampelNode = nodeSore.length;
    } else {
        dtHasil = hitungRataNode(nodeMalam);
        kategoriWaktu = "Malam (19:00 - 00:00)";
        sampelNode = nodeMalam.length;
    }

    // ==========================================
    // METODE 3: KNN REGRESSION (REKOMENDASI - ALGORITMA 3)
    // ==========================================
    const K = 15;
    let dataDenganJarak = dataHistoris.map(row => {
        const jamHistori = new Date(row.created_at).getHours();
        let jarakJam = Math.abs(jamSekarang - jamHistori);
        if (jarakJam > 12) jarakJam = 24 - jarakJam; 

        return {
            suhu: parseFloat(row.suhu),
            kelembapan: parseFloat(row.kelembapan),
            jarak: jarakJam
        };
    });

    dataDenganJarak.sort((a, b) => a.jarak - b.jarak);
    let tetanggaTerdekat = dataDenganJarak.slice(0, K);

    let knnSuhu = parseFloat((tetanggaTerdekat.reduce((sum, item) => sum + item.suhu, 0) / K).toFixed(1));
    let knnLembab = parseFloat((tetanggaTerdekat.reduce((sum, item) => sum + item.kelembapan, 0) / K).toFixed(1));

    // ==========================================
    // UPDATE ELEMEN UI KARTU PREDIKSI
    // ==========================================
    document.getElementById('lr-suhu').innerText = lrSuhu + '°C';
    document.getElementById('lr-lembab').innerText = lrLembab + '%';

    document.getElementById('dt-suhu').innerText = dtHasil.s + '°C';
    document.getElementById('dt-lembab').innerText = dtHasil.l + '%';

    document.getElementById('knn-suhu').innerText = knnSuhu + '°C';
    document.getElementById('knn-lembab').innerText = knnLembab + '%';

    // ==========================================
    // GENERATE KESIMPULAN DINAMIS (CARD BAWAH)
    // ==========================================
    const daftarSuhu = [lrSuhu, dtHasil.s, knnSuhu];
    const selisihMaxSuhu = (Math.max(...daftarSuhu) - Math.min(...daftarSuhu)).toFixed(1);

    let analisisTeks = `Berdasarkan analisis data historis pada <b>Jam ${jamSekarang}:00 WIB</b>, ketiga metode membuahkan hasil kalkulasi yang bervariasi. `;
    analisisTeks += `Model <b>Linear Regression</b> memperkirakan suhu berada di angka <b>${lrSuhu}°C</b>, `;
    analisisTeks += `sedangkan pendekatan segmentasi kaku <b>Decision Tree</b> mematok angka rata-rata waktu di <b>${dtHasil.s}°C</b>. `;
    analisisTeks += `Di sisi lain, algoritma rekomendasi <b>KNN Regression (K=${K})</b> memberikan estimasi situasional di angka <b>${knnSuhu}°C</b> berdasarkan ${K} rekaman waktu terdekat yang paling identik.`;
    
    analisisTeks += `<br/><br/><b>Evaluasi Deviasi:</b> Selisih perbedaan prediksi suhu antarmetode saat ini adalah sebesar <b>${selisihMaxSuhu}°C</b>. `;
    
    if (selisihMaxSuhu > 2) {
        analisisTeks += `Rentang perbedaan yang cukup tinggi (>2°C) ini mengindikasikan adanya lonjakan fluktuasi data lingkungan yang ekstrem pada rekam jejak histori terdekat. Dalam skenario ini, disarankan mengacu pada hasil <b>KNN Regression</b> karena lebih adaptif terhadap pola perubahan non-linier mendadak.`;
    } else {
        analisisTeks += `Rentang variasi yang rendah (<2°C) menunjukkan bahwa kondisi lingkungan ruang saat ini relatif stabil secara historis, sehingga seluruh model kecerdasan buatan mampu menghasilkan nilai prediksi yang konvergen (hampir seragam).`;
    }

    document.getElementById('teks-kesimpulan').innerHTML = analisisTeks;

    // ==========================================
    // GENERATE XAI (EXPLAINABLE AI) INSIGHTS
    // ==========================================
    
    // 1. Render Penjelasan Linear Regression
    const pengaruhSuhu = slopeSuhu > 0 ? "meningkat" : "menurun";
    document.getElementById('xai-lr').innerHTML = `
        <p class="font-semibold text-slate-700">Persamaan Garis Tren Suhu:</p>
        <div class="bg-white p-2 rounded my-1 font-mono text-[11px] text-center border text-indigo-600 font-bold">
            y = (${slopeSuhu.toFixed(4)} * ${jamSekarang}) + (${interceptSuhu.toFixed(2)})
        </div>
        <p>Model mendeteksi bahwa setiap pertambahan jam, tren suhu ruangan akan <b>${pengaruhSuhu}</b> sebesar <b>${Math.abs(slopeSuhu).toFixed(3)}°C</b> berdasarkan kecenderungan linier seluruh data.</p>
    `;

    // 2. Render Penjelasan Decision Tree
    document.getElementById('xai-dt').innerHTML = `
        <p class="font-semibold text-slate-700">Aturan Percabangan Atas:</p>
        <ul class="list-disc pl-4 space-y-1 mt-1">
            <li>Kondisi Root: <span class="bg-slate-100 px-1 rounded font-mono">Jam saat ini = ${jamSekarang}:00</span></li>
            <li>Cabang Terpilih: <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-semibold">${kategoriWaktu}</span></li>
        </ul>
        <p class="mt-2">Algoritma mengabaikan data waktu lain dan hanya menghitung rata-rata dari <b>${sampelNode} sampel data</b> historis yang berada di blok waktu yang sama.</p>
    `;

    // 3. Render Penjelasan KNN
    const rentangSuhuTetangga = tetanggaTerdekat.slice(0, 5).map(t => `${t.suhu}°C`).join(', ');
    document.getElementById('xai-knn').innerHTML = `
        <p class="font-semibold text-slate-700">${K} Titik Data Terdekat (K=${K}):</p>
        <p class="text-slate-500 mt-1">Suhu sampel dari 5 record terdekat masa lalu:</p>
        <div class="bg-white p-2 rounded my-1 font-mono text-[11px] text-center border text-amber-700 font-bold">
            [${rentangSuhuTetangga}, ...]
        </div>
        <p>Prediksi akhir didapatkan dari rata-rata murni nilai lingkungan dari <b>${K} titik data historis</b> yang memiliki karakteristik jam paling mirip (jarak minimum) dengan kondisi target saat ini.</p>
    `;
}

// Inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    ambilDataHistoris();
});