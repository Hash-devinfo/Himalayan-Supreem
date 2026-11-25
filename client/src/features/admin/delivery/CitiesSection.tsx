import { useState } from 'react';
import { Loader2, MapPin, Plus, Search } from 'lucide-react';
import { deliveryAdminApi, type AdminCity, type DeliveryZone } from '../../../api/delivery';
import Badge from '../../../components/ui/Badge';
import FormAlert from '../../../components/ui/FormAlert';
import Pagination from '../../../components/ui/Pagination';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PROVINCES, type Province } from '../../../lib/pakistan';
import { EmptyState, ListSkeleton, Panel, PanelError } from '../dashboard/DashboardPanel';
import { AddCityDialog, EditCityDialog, ZoneSelect } from './CityDialogs';
import { errorText } from './deliveryText';
import { useCityList, useDeliveryMutation } from './queries';

const PAGE_SIZE = 50;

interface CitiesSectionProps {
  zones: DeliveryZone[];
  onNotice: (message: string) => void;
}

export default function CitiesSection({ zones, onNotice }: CitiesSectionProps) {
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedValue(searchText.trim(), 400);
  const [province, setProvince] = useState<Province | ''>('');
  const [zoneFilter, setZoneFilter] = useState(''); // '', 'default' or a zone ID
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AdminCity | 'add' | null>(null);

  const cities = useCityList({
    search: search || undefined,
    province: province || undefined,
    zone: zoneFilter || undefined,
    blocked: blockedOnly ? 'true' : undefined,
    page,
    limit: PAGE_SIZE,
  });
  const assign = useDeliveryMutation((vars: { ids: string[]; zone: string | null }) => deliveryAdminApi.assignZone(vars.ids, vars.zone));

  const rows = cities.data?.cities ?? [];
  const allOnPage = rows.length > 0 && rows.every((c) => selected.has(c._id));
  const zoneName = (id: string) => (id ? (zones.find((z) => z._id === id)?.name ?? 'that zone') : 'the default zone');

  // Changing a filter starts again from page 1 with nothing selected
  function filterChanged() {
    setPage(1);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of rows) {
        if (allOnPage) next.delete(c._id);
        else next.add(c._id);
      }
      return next;
    });
  }

  function moveSelected() {
    setBulkError(null);
    const ids = [...selected];
    assign.mutate(
      { ids, zone: moveTo || null },
      {
        onSuccess: (result) => {
          setSelected(new Set());
          onNotice(
            `${result.changed} ${result.changed === 1 ? 'city' : 'cities'} moved to ${zoneName(moveTo)}` +
              (result.alreadyInZone > 0 ? ` (${result.alreadyInZone} already there).` : '.'),
          );
        },
        onError: (err) => setBulkError(errorText(err)),
      },
    );
  }

  return (
    <>
      <Panel
        title="Cities"
        subtitle="The list customers choose from at checkout, and the zone each city uses"
        action={
          <button type="button" onClick={() => setDialog('add')} className="btn-secondary shrink-0 gap-1.5 px-3 py-1.5 text-sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add city
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative w-full sm:w-56">
            <label htmlFor="city-search" className="sr-only">
              Search cities
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="city-search"
              type="search"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                filterChanged();
              }}
              placeholder="City name"
              className="input-field mt-0 pl-10"
            />
          </div>
          <label htmlFor="city-province-filter" className="sr-only">
            Province
          </label>
          <select
            id="city-province-filter"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value as Province | '');
              filterChanged();
            }}
            className="input-field mt-0 w-full sm:w-auto"
          >
            <option value="">All provinces</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label htmlFor="city-zone-filter" className="sr-only">
            Zone
          </label>
          <select
            id="city-zone-filter"
            value={zoneFilter}
            onChange={(e) => {
              setZoneFilter(e.target.value);
              filterChanged();
            }}
            className="input-field mt-0 w-full sm:w-auto"
          >
            <option value="">All zones</option>
            <option value="default">Using the default zone</option>
            {zones
              .filter((z) => !z.isDefault)
              .map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name}
                </option>
              ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={blockedOnly}
              onChange={(e) => {
                setBlockedOnly(e.target.checked);
                filterChanged();
              }}
              className="accent-sage"
            />
            Not delivered only
          </label>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas px-4 py-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <label htmlFor="bulk-zone" className="text-sm text-muted">
              Move to
            </label>
            <div className="w-full sm:w-56">
              <ZoneSelect id="bulk-zone" value={moveTo} onChange={setMoveTo} zones={zones} />
            </div>
            <button type="button" onClick={moveSelected} disabled={assign.isPending} className="btn-primary gap-2 px-4 py-2 text-sm">
              {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Move
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-muted hover:text-ink">
              Clear
            </button>
            {bulkError && (
              <FormAlert tone="danger" className="w-full">
                {bulkError}
              </FormAlert>
            )}
          </div>
        )}

        {cities.isPending ? (
          <ListSkeleton rows={6} />
        ) : cities.isError ? (
          <PanelError error={cities.error} onRetry={() => void cities.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No cities match"
            text="Try another search, or add the city. Run your city seed script if the list is empty."
          />
        ) : (
          <div className={cities.isPlaceholderData ? 'opacity-60' : ''}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={allOnPage}
                onChange={toggleAll}
                aria-label="Select every city on this page"
                className="accent-sage"
              />
              <span>Select all on this page</span>
            </div>
            <ul className="divide-y divide-line">
              {rows.map((city) => (
                <li key={city._id} className="flex items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(city._id)}
                    onChange={() => toggle(city._id)}
                    aria-label={`Select ${city.name}`}
                    className="accent-sage"
                  />
                  <button
                    type="button"
                    onClick={() => setDialog(city)}
                    className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-medium">{city.name}</span>
                      <span className="block text-xs text-muted">{city.province}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      {city.isBlocked && <Badge tone="danger">Not delivered</Badge>}
                      {city.source === 'customer' && <Badge tone="info">Added by a customer</Badge>}
                      <span className="text-muted">{city.zone ? city.zone.name : 'Default zone'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {cities.data && cities.data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          pages={cities.data.pages}
          total={cities.data.total}
          noun="cities"
          onPage={(next) => {
            setPage(next);
            setSelected(new Set());
          }}
        />
      )}

      {dialog === 'add' && (
        <AddCityDialog
          open
          zones={zones}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            onNotice(message);
          }}
        />
      )}
      {dialog && dialog !== 'add' && (
        <EditCityDialog
          open
          city={dialog}
          zones={zones}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            onNotice(message);
          }}
        />
      )}
    </>
  );
}