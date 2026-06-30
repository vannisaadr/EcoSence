let myChart = null; 

function aturSapaan() {
    const jamSekarang = new Date().getHours();
    let teksSapaan = "Selamat Malam ! "; 

    if (jamSekarang >= 1 && jamSekarang < 11) {
        teksSapaan = "Selamat Pagi !";
    } else if (jamSekarang >= 11 && jamSekarang < 15) {
        teksSapaan = "Selamat Siang !"; 
    } else if (jamSekarang >= 15 && jamSekarang < 18) {
        teksSapaan = "Selamat Sore !";
    } else {
        teksSapaan = "Selamat Malam !";
    }

    const elemenSapaan = document.getElementById('sapaan-text');
    if (elemenSapaan) {
        elemenSapaan.innerText = teksSapaan;
    }
}

// FUNGSI UTAMA: Menarik semua data historis untuk dipelajari oleh algoritma
async function inisialisasiPrediksiAI() {
    // Tampilkan indikator loading di Dashboard
    document.getElementById('prediksi-suhu').innerText = '...';
    document.getElementById('prediksi-lembab').innerText = '...';

    try {
        let semuaDataHistoris = [];
        let batasAwal = 0;
        const limitPerTarik = 1000;
        let masihAdaData = true;

        // Tarik data historis (maksimal kita batasi 50.000 data agar browser tidak hang)
        const MAKSIMAL_DATA = 50000; 

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
            // Setelah data terkumpul, jalankan fungsi Prediksi
            prosesPrediksiKartu(semuaDataHistoris);
            prosesPrediksiGrafik(semuaDataHistoris);
        }

    } catch (err) {
        console.error("Gagal menarik data untuk AI:", err);
        document.getElementById('prediksi-suhu').innerText = 'Err';
        document.getElementById('prediksi-lembab').innerText = 'Err';
    }
}

// FUNGSI AI 1: Memprediksi Suhu Menggunakan Linear Regression (Supervised Learning)
function prosesPrediksiKartu(dataHistoris) {
    const jamSekarangWIB = new Date().getHours();
    
    // 1. Siapkan data X (Jam) dan Y (Suhu/Kelembapan)
    let n = dataHistoris.length;
    let sumX = 0, sumY_suhu = 0, sumY_lembab = 0;
    let sumXY_suhu = 0, sumXY_lembab = 0;
    let sumXX = 0;

    dataHistoris.forEach(row => {
        const x = new Date(row.created_at).getHours(); // Input X: Jam historis
        const y_suhu = parseFloat(row.suhu);          // Target Y1: Suhu asli
        const y_lembab = parseFloat(row.kelembapan);   // Target Y2: Kelembapan asli

        sumX += x;
        sumXX += x * x;
        
        sumY_suhu += y_suhu;
        sumXY_suhu += x * y_suhu;

        sumY_v = y_lembab; // Kelembapan
        sumY_lembab += y_lembab;
        sumXY_lembab += x * y_lembab;
    });

    // 2. Rumus Linear Regression: Mencari Slope (m) dan Intercept (c) -> y = mx + c
    // Rumus Slope (m)
    const slopeSuhu = (n * sumXY_suhu - sumX * sumY_suhu) / (n * sumXX - sumX * sumX);
    const slopeLembab = (n * sumXY_lembab - sumX * sumY_lembab) / (n * sumXX - sumX * sumX);

    // Rumus Intercept (c)
    const interceptSuhu = (sumY_suhu - slopeSuhu * sumX) / n;
    const interceptLembab = (sumY_lembab - slopeLembab * sumX) / n;

    // 3. Prediksi Nilai Kontinu untuk Jam Sekarang (X = jamSekarangWIB)
    let suhuPrediksi = parseFloat((slopeSuhu * jamSekarangWIB + interceptSuhu).toFixed(1));
    let lembabPrediksi = parseFloat((slopeLembab * jamSekarangWIB + interceptLembab).toFixed(1));

    // Jika hasil regresi menghasilkan angka aneh karena data kurang, beri fallback data terakhir
    if (isNaN(suhuPrediksi)) {
        suhuPrediksi = parseFloat(dataHistoris[0].suhu);
        lembabPrediksi = parseFloat(dataHistoris[0].kelembapan);
    }

    // --- DI SINI KE BAWAH ADALAH KODE UPDATE UI (TETAP SAMA SEPERTI KODE LAMA KAMU) ---
    document.getElementById('prediksi-suhu').innerText = suhuPrediksi + '°C';
    document.getElementById('prediksi-lembab').innerText = lembabPrediksi + '%';

    // Update Status Suhu
    let statusSuhu = ""; let warnaSuhu = ""; let ikonSuhu = "";
    if (suhuPrediksi <= 25) {
        statusSuhu = "Cenderung Sejuk"; warnaSuhu = "text-blue-500"; ikonSuhu = "fas fa-snowflake";
    } else if (suhuPrediksi <= 32) {
        statusSuhu = "Prediksi Normal"; warnaSuhu = "text-emerald-500"; ikonSuhu = "fas fa-check-circle";
    } else {
        statusSuhu = "Potensi Panas"; warnaSuhu = "text-red-500"; ikonSuhu = "fas fa-fire";
    }

    const elemenStatusSuhu = document.getElementById('status-suhu');
    if (elemenStatusSuhu) {
        elemenStatusSuhu.className = `text-sm font-semibold flex items-center ${warnaSuhu}`;
        elemenStatusSuhu.innerHTML = `<i class="${ikonSuhu} mr-2"></i> ${statusSuhu}`;
    }

    // Update Keterangan Prediksi Suhu (Log Bawah)
    const teksSuhuEl = document.getElementById('ket-teks-suhu');
    const iconBgSuhu = document.getElementById('ket-icon-bg-suhu');
    if (suhuPrediksi > 32) {
        teksSuhuEl.innerHTML = `<b>Prediksi:</b> Suhu diprediksi memanas (<b>${suhuPrediksi}°C</b>).`;
        iconBgSuhu.className = "w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0 mt-0.5";
    } else {
        teksSuhuEl.innerHTML = `<b>Prediksi:</b> Tren suhu stabil di <b>${suhuPrediksi}°C</b>.`;
        iconBgSuhu.className = "w-8 h-8 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5";
    }

    // Update Keterangan Prediksi Lembab (Log Bawah)
    const teksLembabEl = document.getElementById('ket-teks-lembab');
    const iconBgLembab = document.getElementById('ket-icon-bg-lembab');
    if (lembabPrediksi > 60) {
        teksLembabEl.innerHTML = `<b>Prediksi:</b> Potensi udara pengap karena kelembapan mencapai <b>${lembabPrediksi}%</b>.`;
        iconBgLembab.className = "w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0 mt-0.5";
    } else {
        teksLembabEl.innerHTML = `<b>Prediksi:</b> Kelembapan diprediksi ideal di angka <b>${lembabPrediksi}%</b>.`;
        iconBgLembab.className = "w-8 h-8 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5";
    }

    // Update Status Kelembapan
    let statusLembab = ""; let warnaLembab = ""; let ikonLembab = "";
    if (lembabPrediksi > 60) {
        statusLembab = "Potensi Lembab"; warnaLembab = "text-blue-500"; ikonLembab = "fas fa-cloud-rain"; 
    } else if (lembabPrediksi < 40) {
        statusLembab = "Potensi Kering"; warnaLembab = "text-orange-500"; ikonLembab = "fas fa-sun"; 
    } else {
        statusLembab = "Prediksi Normal"; warnaLembab = "text-emerald-500"; ikonLembab = "fas fa-check-circle"; 
    }

    const elemenStatusLembab = document.getElementById('status-lembab');
    if (elemenStatusLembab) {
        elemenStatusLembab.className = `text-sm font-semibold flex items-center ${warnaLembab}`;
        elemenStatusLembab.innerHTML = `<i class="${ikonLembab} mr-2"></i> ${statusLembab}`;
    }
}

// FUNGSI AI 2: Memprediksi Pola Suhu Harian (Grafik)
function prosesPrediksiGrafik(dataHistoris) {
    let wadah = { Pagi: [], Siang: [], Sore: [], Malam: [] };

    // Kelompokkan SEMUA histori 5 hari ke dalam kategori waktu
    dataHistoris.forEach(item => {
        const jam = new Date(item.created_at).getHours();
        const suhu = parseFloat(item.suhu);

        if (jam >= 1 && jam <= 10) wadah.Pagi.push(suhu);
        else if (jam >= 11 && jam <= 14) wadah.Siang.push(suhu);
        else if (jam >= 15 && jam <= 18) wadah.Sore.push(suhu);
        else wadah.Malam.push(suhu);
    });

    // Rumus memproses Array menjadi satu angka rata-rata pola harian
    const hitungPrediksi = (arr) => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b) / arr.length).toFixed(1)) : null;

    const dataPrediksiFinal = [
        hitungPrediksi(wadah.Pagi),
        hitungPrediksi(wadah.Siang),
        hitungPrediksi(wadah.Sore),
        hitungPrediksi(wadah.Malam)
    ];

    // Menggambar Grafik Prediksi
    const ctx = document.getElementById('trendSuhuChart').getContext('2d');
    if (myChart) myChart.destroy(); 

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Pagi', 'Siang', 'Sore', 'Malam'],
            datasets: [{
                label: 'Prediksi Suhu Historis (°C)',
                data: dataPrediksiFinal,
                borderColor: '#4f46e5', // Kembali ke warna ungu
                backgroundColor: 'rgba(79, 70, 229, 0.1)', // Kembali ke warna ungu transparan
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    suggestedMin: 30, 
                    suggestedMax: 34,
                    ticks: {
                        stepSize: 1
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Prediksi: ${context.parsed.y} °C`;
                        }
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    aturSapaan();
    inisialisasiPrediksiAI(); // Jalankan proses AI saat halaman dimuat
});