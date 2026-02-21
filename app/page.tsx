import { Map } from '@/components/Map';

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-slate-100 overflow-hidden">
      {/* Header overlay */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 z-[1000] flex flex-col items-center pt-6 md:pt-8 px-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 drop-shadow-sm text-center">
          ДУПКИТЕ НА ЛОВЕЧ
        </h1>
        <p className="text-sm md:text-base text-slate-700 mt-1 drop-shadow-sm">
          Гражданска карта на пътните неравности
        </p>
      </div>

      {/* Map full screen - absolute inset-0 */}
      <div className="absolute inset-0">
        <Map />
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] rounded-lg bg-white/95 backdrop-blur px-3 py-2 text-xs text-slate-700 border border-slate-200 shadow-md pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-severity-1" /> До 3 см
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-3 h-3 rounded-full bg-severity-2" /> 3–7 см
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-3 h-3 rounded-full bg-severity-3" /> Над 7 см
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 left-4 right-20 md:right-80 z-[1000] text-[10px] md:text-xs text-slate-600 max-w-md space-y-1">
        <p className="pointer-events-none">
          Платформата представлява гражданска инициатива за визуализиране на пътни сигнали.
        </p>
        <p className="pointer-events-auto">
          Сайтът е разработен от{' '}
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
