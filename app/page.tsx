import { Map } from '@/components/Map';

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-slate-100 overflow-hidden">
      {/* Header overlay */}
      <div className="pointer-events-none absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-[1000] flex flex-col items-center rounded-lg bg-white/95 backdrop-blur px-3 py-2 sm:px-4 sm:py-3 border border-slate-200 shadow-md">
        <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 drop-shadow-sm text-center">
          ДУПКИТЕ НА ЛОВЕЧ
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-slate-700 mt-0.5 sm:mt-1 drop-shadow-sm text-center">
          Гражданска карта на пътните неравности
        </p>
      </div>

      {/* Map full screen - absolute inset-0 */}
      <div className="absolute inset-0">
        <Map />
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-[1000] rounded-lg bg-white/95 backdrop-blur px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-3 text-[10px] sm:text-xs md:text-sm text-slate-700 border border-slate-200 shadow-md pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded-full bg-severity-1" /> До 3 см
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded-full bg-severity-2" /> 3–7 см
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded-full bg-severity-3" /> Над 7 см
        </div>
      </div>

      {/* Footer - hidden on very small screens, shown on sm+ */}
      <footer className="hidden sm:block absolute bottom-4 left-4 right-32 md:right-48 lg:right-80 z-[1000] text-xs md:text-sm text-slate-600 max-w-sm md:max-w-md space-y-1 rounded-lg bg-white/95 backdrop-blur px-3 py-2 md:px-4 md:py-3 border border-slate-200 shadow-md">
        <p className="pointer-events-none">
          Гражданска инициатива за визуализиране на пътни сигнали.
        </p>
        <p className="pointer-events-auto">
          Разработен от{' '}
          <a
            href="https://www.hmwspro.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-700 underline hover:text-slate-900"
          >
            H&amp;M Website Provisioning
          </a>
        </p>
      </footer>
    </main>
  );
}
