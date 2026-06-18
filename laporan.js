let semuaDataGrup = []; 
let currentPage = 1;
const rowsPerPage = 10;

async function muatLaporan() {
    const inputTanggal = document.getElementById('filter-tanggal').value;
    // MENGAMBIL NILAI FILTER JAM
    const inputJam = document.getElementById('filter-jam').value; 
    const tbody = document.getElementById('tabel-laporan-body');
    
    tbody.innerHTML = `<tr><td colspan="5" class="px-8 py-20 text-center text-slate-400 italic">Sedang menarik dan memproses data dari Supabase (mohon tunggu)...</td></tr>`;

    try {
        let semuaDataMentah = [];
        let batasAwal = 0;
        const limitPerTarik = 1000; 
        let masihAdaData = true;

        // 1. TARIK SEMUA DATA
        while (masihAdaData) {
            let query = db.from('monitoring_suhu')
                          .select('*')
                          .order('created_at', { ascending: false })
                          .range(batasAwal, batasAwal + limitPerTarik - 1);

            if (inputTanggal && inputTanggal !== "") {
                query = query
                    .gte('created_at', `${inputTanggal}T00:00:00+07:00`)
                    .lte('created_at', `${inputTanggal}T23:59:59+07:00`);
            }

            const { data, error } = await query;
            if (error) throw error;

            semuaDataMentah = semuaDataMentah.concat(data);
            if (data.length < limitPerTarik) masihAdaData = false;
            batasAwal += limitPerTarik;
        }

        // 2. PROSES GROUPING PER JAM
        const grup = {};
        semuaDataMentah.forEach(row => {
            const dt = new Date(row.created_at);
            const tahun = dt.getFullYear();
            const bulan = String(dt.getMonth() + 1).padStart(2, '0');
            const hari = String(dt.getDate()).padStart(2, '0');
            const tglLokal = `${tahun}-${bulan}-${hari}`; 
            
            const jamNum = dt.getHours();
            const jamString = String(jamNum).padStart(2, '0'); 
            const key = `${tglLokal}_${jamString}`;

            if (!grup[key]) {
                grup[key] = { tgl: tglLokal, jam: jamNum, suhu: [], lembab: [] };
            }
            grup[key].suhu.push(parseFloat(row.suhu));
            grup[key].lembab.push(parseFloat(row.kelembapan));
        });

        // 3. HITUNG RATA-RATA & FILTER BERDASARKAN JAM
        semuaDataGrup = Object.keys(grup)
            .sort((a, b) => b.localeCompare(a))
            .map(key => {
                const item = grup[key];
                const rerataSuhu = (item.suhu.reduce((a, b) => a + b, 0) / item.suhu.length).toFixed(1);
                const rerataLembab = (item.lembab.reduce((a, b) => a + b, 0) / item.lembab.length).toFixed(1);
                return { ...item, rerataSuhu, rerataLembab };
            })
            // LOGIKA FILTER JAM: Jika jam dipilih (tidak "semua"), maka saring data
            .filter(item => {
                if (!inputJam || inputJam === "semua") return true;
                return item.jam === parseInt(inputJam);
            });

        currentPage = 1;
        tampilkanTabel();

    } catch (err) {
        console.error("Gagal memuat:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="px-8 py-10 text-center text-red-500 font-bold">Error Database: ${err.message}</td></tr>`;
    }
}

function tampilkanTabel() {
    const tbody = document.getElementById('tabel-laporan-body');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const dataHalaman = semuaDataGrup.slice(start, end);

    if (dataHalaman.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-8 py-10 text-center text-slate-400">Tidak ada data ditemukan untuk rentang waktu ini.</td></tr>`;
        return;
    }

    dataHalaman.forEach(item => {
        let statusTeks = "NORMAL";
        let statusKelas = "bg-emerald-100 text-emerald-600";
        
        if (item.rerataSuhu > 32) {
            statusTeks = "PANAS";
            statusKelas = "bg-red-100 text-red-600";
        }

        const jamMulai = String(item.jam).padStart(2, '0');
        const jamSelesai = String((item.jam + 1) % 24).padStart(2, '0');

        tbody.innerHTML += `
            <tr class="border-t border-slate-50 hover:bg-slate-50 transition">
                <td class="px-8 py-5 text-sm font-medium text-slate-500">${item.tgl}</td>
                <td class="px-8 py-5 text-sm font-bold text-slate-800">
                    ${jamMulai}:00 - ${jamSelesai}:00
                </td>
                <td class="px-8 py-5 text-sm text-center font-semibold text-slate-700">${item.rerataSuhu}°C</td>
                <td class="px-8 py-5 text-sm text-center font-semibold text-slate-700">${item.rerataLembab}%</td>
                <td class="px-8 py-5">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${statusKelas}">
                        ${statusTeks}
                    </span>
                </td>
            </tr>
        `;
    });

    updatePaginationUI();
}

function updatePaginationUI() {
    const totalPages = Math.ceil(semuaDataGrup.length / rowsPerPage);
    document.getElementById('pageInfo').innerText = `HALAMAN ${currentPage} DARI ${totalPages || 1}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

// --- LOGIKA DROPDOWN MENU ---
const btnCetak = document.getElementById('btn-cetak');
const dropdownCetak = document.getElementById('dropdown-cetak');

// Munculkan/Sembunyikan dropdown saat tombol diklik
btnCetak.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownCetak.classList.toggle('hidden');
});

// Sembunyikan dropdown jika klik di luar menu
window.addEventListener('click', () => {
    dropdownCetak.classList.add('hidden');
});

// --- FUNGSI UNDUH PDF ---
// --- FUNGSI UNDUH PDF (CETAK SEMUA DATA) ---
function unduhPDF() {
    if (!semuaDataGrup || semuaDataGrup.length === 0) {
        alert("Data tidak tersedia untuk dicetak!");
        return;
    }

    const tbody = document.getElementById('tabel-laporan-body');
    const sidebar = document.querySelector('aside');
    const headerBtn = document.querySelector('.relative.inline-block'); // Tombol Cetak & Dropdown
    const filterSection = document.querySelector('.flex.flex-wrap.gap-4'); // Area Filter (jika ada)
    const pagination = document.querySelector('.flex.justify-between.items-center.px-4.py-4'); // Navigasi halaman
    const mainContent = document.querySelector('main');

    // 1. SIMPAN KONTEN ASLI (halaman saat ini)
    const kontenHalamanSaatIni = tbody.innerHTML;

    // 2. RENDER SEMUA DATA KE DALAM TABEL (Tanpa Potongan Paginasi)
    let semuaBarisHTML = '';
    semuaDataGrup.forEach(item => {
        let statusTeks = "NORMAL";
        let statusKelas = "bg-emerald-100 text-emerald-600";
        
        if (item.rerataSuhu > 32) {
            statusTeks = "PANAS";
            statusKelas = "bg-red-100 text-red-600";
        }

        const jamMulai = String(item.jam).padStart(2, '0');
        const jamSelesai = String((item.jam + 1) % 24).padStart(2, '0');

        semuaBarisHTML += `
            <tr class="border-t border-slate-200">
                <td class="px-8 py-4 text-sm text-slate-500">${item.tgl}</td>
                <td class="px-8 py-4 text-sm font-bold text-slate-800">
                    ${jamMulai}:00 - ${jamSelesai}:00
                </td>
                <td class="px-8 py-4 text-sm text-center font-semibold text-slate-700">${item.rerataSuhu}°C</td>
                <td class="px-8 py-4 text-sm text-center font-semibold text-slate-700">${item.rerataLembab}%</td>
                <td class="px-8 py-4">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${statusKelas}">
                        ${statusTeks}
                    </span>
                </td>
            </tr>
        `;
    });
    
    // Ganti isi tabel dengan semua data
    tbody.innerHTML = semuaBarisHTML;

    // 3. SEMBUNYIKAN ELEMEN UI YANG TIDAK DIPERLUKAN
    if (sidebar) sidebar.style.display = 'none';
    if (headerBtn) headerBtn.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (filterSection) filterSection.style.display = 'none';
    if (mainContent) mainContent.classList.remove('ml-64');

    // 4. JALANKAN PRINT
    // Memberikan sedikit jeda agar browser sempat merender ulang tabel yang panjang
    setTimeout(() => {
        window.print();

        // 5. KEMBALIKAN TAMPILAN SEMULA
        tbody.innerHTML = kontenHalamanSaatIni;
        if (sidebar) sidebar.style.display = 'flex';
        if (headerBtn) headerBtn.style.display = 'inline-block';
        if (pagination) pagination.style.display = 'flex';
        if (filterSection) filterSection.style.display = 'flex';
        if (mainContent) mainContent.classList.add('ml-64');
    }, 250);
}

function unduhCSV() {
    if (!semuaDataGrup || semuaDataGrup.length === 0) {
        alert("Data belum siap atau kosong!");
        return;
    }

    // 1. Tambahkan instruksi 'sep=,' agar Excel otomatis membagi kolom dengan benar
    // 2. Gunakan header yang bersih
    let csvContent = "sep=,\n"; 
    csvContent += "Tanggal,Rentang Jam,Rerata Suhu (C),Rerata Lembab (%),Status\n";

    semuaDataGrup.forEach(item => {
        const jamMulai = String(item.jam).padStart(2, '0');
        const jamSelesai = String((item.jam + 1) % 24).padStart(2, '0');
        
        // Logika status berdasarkan suhu (Contoh: > 32 derajat dianggap PANAS)
        const status = item.rerataSuhu > 32 ? "PANAS" : "NORMAL";
        
        // Menyusun baris data
        csvContent += `${item.tgl},${jamMulai}:00 - ${jamSelesai}:00,${item.rerataSuhu},${item.rerataLembab},${status}\n`;
    });

    // 3. Tambahkan BOM (\uFEFF) agar karakter khusus (seperti simbol derajat) terbaca dengan benar
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    // Penamaan file otomatis dengan tanggal hari ini
    const fileName = `Laporan_EcoSense_${new Date().toISOString().split('T')[0]}.csv`;
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event Listeners Navigasi
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        tampilkanTabel();
        window.scrollTo(0, 0);
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(semuaDataGrup.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        tampilkanTabel();
        window.scrollTo(0, 0);
    }
});

// EVENT LISTENERS UNTUK KEDUA FILTER
document.getElementById('filter-tanggal').addEventListener('change', muatLaporan);
// Pastikan baris ini ada di bagian paling bawah laporan.js
document.getElementById('filter-jam').addEventListener('change', muatLaporan);

document.addEventListener('DOMContentLoaded', () => {
    muatLaporan();
});