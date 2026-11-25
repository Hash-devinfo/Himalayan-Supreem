import { useEffect, useState } from 'react';
import FormAlert from '../../../components/ui/FormAlert';
import CitiesSection from '../../../features/admin/delivery/CitiesSection';
import { useZones } from '../../../features/admin/delivery/queries';
import ZonesSection from '../../../features/admin/delivery/ZonesSection';

export default function DeliveryPage() {
  const zones = useZones();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium">Delivery</h1>
        <p className="mt-1 text-sm text-muted">
          What customers pay for delivery and how long it takes, by city. Checkout uses these charges.
        </p>
      </header>

      {notice && (
        <FormAlert tone="success" className="">
          {notice}
        </FormAlert>
      )}

      <ZonesSection onNotice={setNotice} />
      <CitiesSection zones={zones.data?.zones ?? []} onNotice={setNotice} />
    </div>
  );
}