import { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import FormAlert from '../../../../components/ui/FormAlert';

interface PrintToolbarProps {
  title: string; // also the file name when saving as PDF
  backTo: string;
  notices?: string[]; // shown on screen, never printed
  canPrint?: boolean;
  widthClass?: string;
}

export default function PrintToolbar({ title, backTo, notices = [], canPrint = true, widthClass = 'max-w-[210mm]' }: PrintToolbarProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className={`mx-auto mb-4 space-y-3 px-4 print:hidden ${widthClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to order
        </Link>
        {canPrint && (
          <button type="button" onClick={() => window.print()} className="btn-primary gap-2">
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print or save as PDF
          </button>
        )}
      </div>
      {notices.map((notice) => (
        <FormAlert key={notice} tone="warning" className="">
          {notice}
        </FormAlert>
      ))}
    </div>
  );
}