import CellDetailPanel from 'src/components/CellDetailPanel';
import IntroHero from 'src/components/IntroHero';
import MapToolbar from 'src/components/MapToolbar';
import MapCanvasPanel from 'src/views/HomeView/MapCanvasPanel';

export default function HomeView() {
  return (
    <main className="bg-background h-dvh w-full overflow-hidden">
      <section className="flex h-full w-full">
        <div className="relative h-full min-w-0 flex-1">
          <MapCanvasPanel />
          <MapToolbar />
        </div>
        <CellDetailPanel />
        <IntroHero />
      </section>
    </main>
  );
}
