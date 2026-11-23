import { MapPinOff, MessageSquareWarning, PackageX, ShieldAlert, ShieldX, type LucideIcon } from 'lucide-react';
import type { OrderListItem } from '../../../api/orders';
import Badge, { type BadgeTone } from '../../../components/ui/Badge';

interface FlagInfo {
  key: string;
  label: string;
  title: string;
  tone: BadgeTone;
  icon: LucideIcon;
}

function flagsFor(order: OrderListItem): FlagInfo[] {
  const flags: FlagInfo[] = [];
  if (order.risk === 'blocked') {
    flags.push({ key: 'blocked', label: 'Blocked number', title: 'This phone number is blocked', tone: 'danger', icon: ShieldX });
  } else if (order.risk === 'high') {
    flags.push({ key: 'risk', label: 'High risk', title: 'This number has refused or not collected parcels before', tone: 'danger', icon: ShieldAlert });
  }
  if (order.flags.cancellationRequested) {
    flags.push({ key: 'cancel', label: 'Cancel request', title: 'The customer asked to cancel', tone: 'danger', icon: MessageSquareWarning });
  }
  if (order.flags.stockShortfall) {
    flags.push({ key: 'stock', label: 'Stock short', title: 'Not enough sellable stock to cover this order', tone: 'warning', icon: PackageX });
  }
  if (order.flags.unlistedCity) {
    flags.push({ key: 'city', label: 'New city', title: 'The customer typed a city that is not in the delivery list', tone: 'warning', icon: MapPinOff });
  }
  return flags;
}

export default function OrderFlags({ order }: { order: OrderListItem }) {
  const flags = flagsFor(order);
  if (flags.length === 0) return null;

  return (
    <span className="flex flex-wrap gap-1">
      {flags.map(({ key, label, title, tone, icon: Icon }) => (
        <span key={key} title={title}>
          <Badge tone={tone}>
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
          </Badge>
        </span>
      ))}
    </span>
  );
}