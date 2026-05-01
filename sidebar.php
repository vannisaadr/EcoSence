<aside class="w-64 sidebar flex flex-col fixed h-full border-r border-slate-100 z-10">
    <div class="p-8 flex items-center space-x-3">
        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <i class="fas fa-droplet text-xl"></i>
        </div>
        <div>
            <h1 class="font-bold text-lg text-indigo-900 tracking-tight">EcoSense</h1>
            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Sistem Monitoring</p>
        </div>
    </div>

    <nav class="mt-4 flex-grow">
        <a href="dashboard.php" class="nav-item <?php echo (basename($_SERVER['PHP_SELF']) == 'dashboard.php') ? 'active' : ''; ?>">
            <i class="fas fa-th-large w-5 mr-3"></i> Ringkasan
        </a>
        <a href="analitik.php" class="nav-item <?php echo (basename($_SERVER['PHP_SELF']) == 'analitik.php') ? 'active' : ''; ?>">
            <i class="fas fa-chart-line w-5 mr-3"></i> Analitik
        </a>
        <a href="#" class="nav-item">
            <i class="fas fa-file-invoice w-5 mr-3"></i> Laporan
        </a>
    </nav>

    <div class="p-6">
        <button class="btn-export w-full text-white py-3.5 rounded-2xl flex items-center justify-center font-semibold text-sm transition-all hover:scale-[1.02]">
            <i class="fas fa-download mr-2"></i> Ekspor Laporan
        </button>
    </div>
</aside>