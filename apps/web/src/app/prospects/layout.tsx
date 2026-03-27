import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export default function ProspectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
       <div className="flex h-[60vh] items-center justify-center">
         <Loader2 className="w-10 h-10 text-primary animate-spin" />
       </div>
    }>
      {children}
    </Suspense>
  );
}
