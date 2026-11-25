import { useState } from 'react';
import { Link } from 'react-router';
import { Loader2, MapPinned, Pencil, Plus, Star } from 'lucide-react';
import { deliveryAdminApi, type DeliveryZone } from '../../../api/delivery';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import { formatRs } from '../../../lib/format';
import { EmptyState, ListSkeleton, Panel, PanelError } from '../dashboard/DashboardPanel';
import { useSettings } from '../settings/queries';
import { errorText, formatGrams, zoneChargeSummary } from './deliveryText';
import { useDeliveryMutation, useZones } from './queries';
import ZoneDialog from './ZoneDialog';

interface ZonesSectionProps {
  onNotice: (message: string) => void;
}

function FreeDeliveryNote() {
  const settings = useSettings();
  const threshold = settings.data?.settings.freeDeliveryThreshold;
  if (!settings.data) return null;

  return (
    <p className="border-t border-line px-4 py-3 text-xs text-muted">
      {threshold !== undefined ? (
        <>
          <span className="font-medium text-ink">Free delivery</span> on orders of {formatRs(threshold)} or more, in every zone.{' '}
        </>
      ) : (
        'Free delivery is off. '
      )}
      <Link to="/admin/settings" className="text-sage underline-offset-4 hover:underline">
        Change in Settings
      </Link>
    </p>
  );
}

function ZoneRow({ zone, onEdit, onNotice }: { zone: DeliveryZone; onEdit: () => void; onNotice: (message: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const makeDefault = useDeliveryMutation(() => deliveryAdminApi.makeDefault(zone._id));
  const toggle = useDeliveryMutation((active: boolean) => deliveryAdminApi.updateZone(zone._id, { active }));
  const busy = makeDefault.isPending || toggle.isPending;

  function run(action: 'default' | 'off' | 'on') {
    setError(null);
    const handlers = { onError: (err: unknown) => setError(errorText(err)) };
    if (action === 'default') {
      makeDefault.mutate(undefined, {
        ...handlers,
        onSuccess: () => onNotice(`"${zone.name}" is now the default zone for every city without its own zone.`),
      });
    } else {
      toggle.mutate(action === 'on', {
        ...handlers,
        onSuccess: () => onNotice(action === 'on' ? `"${zone.name}" is on.` : `"${zone.name}" is off.`),
      });
    }
  }

  return (
    <li className={`px-4 py-4 ${zone.active ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {zone.name}
            {zone.isDefault && <Badge tone="success">Default</Badge>}
            {!zone.active && <Badge tone="neutral">Off</Badge>}
          </p>
          <p className="mt-1 text-sm">{zoneChargeSummary(zone)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {zone.estimateText} · {zone.cityCount} {zone.cityCount === 1 ? 'city' : 'cities'}
            {zone.isDefault ? ' (including all cities without their own zone)' : ''}
          </p>
          {zone.weightRules.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {zone.weightRules.map((r) => `up to ${formatGrams(r.upToGrams)}: ${formatRs(r.charge)}`).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Saving" />}
          <button type="button" onClick={onEdit} className="btn-secondary gap-1.5 px-3 py-1.5 text-sm">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
          {!zone.isDefault && zone.active && (
            <button type="button" onClick={() => run('default')} disabled={busy} className="btn-secondary gap-1.5 px-3 py-1.5 text-sm">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Make default
            </button>
          )}
          {!zone.isDefault && (
            <button
              type="button"
              onClick={() => run(zone.active ? 'off' : 'on')}
              disabled={busy}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              {zone.active ? 'Turn off' : 'Turn on'}
            </button>
          )}
        </div>
      </div>
      {error && (
        <FormAlert tone="danger" className="mt-3">
          {error}
        </FormAlert>
      )}
    </li>
  );
}

export default function ZonesSection({ onNotice }: ZonesSectionProps) {
  const zones = useZones();
  const [editing, setEditing] = useState<DeliveryZone | 'new' | null>(null);

  return (
    <>
      {zones.data && !zones.data.hasDefault && (
        <FormAlert tone="danger" className="">
          There's no default zone, so checkout can't work out a delivery charge for most cities. Create a zone and click{' '}
          <span className="font-medium">Make default</span>.
        </FormAlert>
      )}

      <Panel
        title="Delivery zones"
        subtitle="Each zone has its own charge and delivery time. Cities without a zone use the default zone."
        action={
          <button type="button" onClick={() => setEditing('new')} className="btn-primary shrink-0 gap-1.5 px-3 py-1.5 text-sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New zone
          </button>
        }
      >
        {zones.isPending ? (
          <ListSkeleton rows={2} />
        ) : zones.isError ? (
          <PanelError error={zones.error} onRetry={() => void zones.refetch()} />
        ) : zones.data.zones.length === 0 ? (
          <EmptyState icon={MapPinned} title="No delivery zones yet" text="Create your first zone, then make it the default." />
        ) : (
          <ul className="divide-y divide-line">
            {zones.data.zones.map((zone) => (
              <ZoneRow key={zone._id} zone={zone} onEdit={() => setEditing(zone)} onNotice={onNotice} />
            ))}
          </ul>
        )}
        <FreeDeliveryNote />
      </Panel>

      {editing && (
        <ZoneDialog
          open
          zone={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            onNotice(message);
          }}
        />
      )}
    </>
  );
}