import { Plus, Waypoints } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,_var(--accent),_transparent_30rem)] p-6">
      <section
        aria-labelledby="welcome-title"
        className="w-full max-w-2xl rounded-2xl border bg-card p-8 shadow-sm sm:p-12"
      >
        <div className="mb-8 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Waypoints aria-hidden="true" className="size-6" />
        </div>
        <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          The Node Walk
        </p>
        <h1
          id="welcome-title"
          className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
        >
          Give shape to ideas that are still coming together.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
          Create a visual mind map: connect concepts, open their cards, and move through your
          thinking without losing context.
        </p>
        <Button className="mt-8" size="lg">
          <Plus aria-hidden="true" />
          Create my first map
        </Button>
      </section>
    </main>
  );
}
