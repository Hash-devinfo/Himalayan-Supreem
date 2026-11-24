import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ApiError } from "../../../../api/client";
import { deliveryApi, type CityOption } from "../../../../api/delivery";
import {
  ordersApi,
  type OrderDetail,
  type UpdateContactInput,
  type UpdateContactResponse,
} from "../../../../api/orders";
import FormAlert from "../../../../components/ui/FormAlert";
import Modal from "../../../../components/ui/Modal";
import { formatRs } from "../../../../lib/format";
import { PROVINCES } from "../../../../lib/pakistan";
import { useOrderMutation } from "./useOrderMutation";

const OTHER_CITY = "other";

function groupByProvince(cities: CityOption[]) {
  return PROVINCES.map((province) => ({
    province,
    cities: cities.filter((c) => c.province === province),
  })).filter((group) => group.cities.length > 0);
}

function DeliveryResult({ result }: { result: UpdateContactResponse }) {
  const d = result.delivery;
  if (!d) return null;
  if (d.applied) {
    return (
      <p className="text-sm">
        Delivery charge is now{" "}
        <span className="font-medium">{formatRs(d.newCityCharge)}</span> (
        {d.zone}). The order total has been updated.
      </p>
    );
  }
  if (d.newCityCharge !== d.agreedCharge) {
    return (
      <p className="text-sm">
        Delivery charge kept at{" "}
        <span className="font-medium">{formatRs(d.agreedCharge)}</span>, as
        agreed at checkout. The new city's charge would be{" "}
        {formatRs(d.newCityCharge)}.
      </p>
    );
  }
  return (
    <p className="text-sm">
      The delivery charge stays {formatRs(d.agreedCharge)}.
    </p>
  );
}
function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1.5 text-xs text-danger">{message}</p>
  ) : null;
}

interface FormProps {
  order: OrderDetail;
  onClose: () => void;
}

function EditContactForm({ order, onClose }: FormProps) {
  const c = order.customerSnapshot;
  const a = c.address;

  const cities = useQuery({
    queryKey: ["delivery", "cities"],
    queryFn: deliveryApi.publicCities,
    staleTime: 10 * 60_000,
  });

  const [name, setName] = useState(c.name);
  const [phone, setPhone] = useState(c.phone);
  const [email, setEmail] = useState(c.email ?? "");
  const [line1, setLine1] = useState(a.line1);
  const [line2, setLine2] = useState(a.line2 ?? "");
  const [area, setArea] = useState(a.area ?? "");
  const [cityChoice, setCityChoice] = useState(
    a.cityUnlisted || !a.cityRef ? OTHER_CITY : a.cityRef,
  );
  const [cityName, setCityName] = useState(a.cityUnlisted ? a.city : "");
  const [province, setProvince] = useState(a.province);
  const [recalculate, setRecalculate] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<UpdateContactResponse | null>(null);

  const mutation = useOrderMutation((body: UpdateContactInput) =>
    ordersApi.updateContact(order.orderNumber, body),
  );

  const addressChanged =
    line1.trim() !== a.line1 ||
    line2.trim() !== (a.line2 ?? "") ||
    area.trim() !== (a.area ?? "") ||
    (cityChoice === OTHER_CITY
      ? !a.cityUnlisted || cityName.trim() !== a.city || province !== a.province
      : cityChoice !== a.cityRef);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const body: UpdateContactInput = {};
    if (name.trim() !== c.name) body.name = name.trim();
    if (phone.trim() !== c.phone) body.phone = phone.trim();
    const trimmedEmail = email.trim();
    if (trimmedEmail !== (c.email ?? ""))
      body.email = trimmedEmail === "" ? null : trimmedEmail;
    if (addressChanged) {
      body.address = {
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        area: area.trim() || undefined,
        ...(cityChoice === OTHER_CITY
          ? { cityName: cityName.trim(), province }
          : { cityId: cityChoice }),
      };
      body.recalculateDelivery = recalculate;
    }
    if (note.trim()) body.note = note.trim();

    if (
      !body.name &&
      !body.phone &&
      body.email === undefined &&
      !body.address
    ) {
      setError("Nothing has changed yet.");
      return;
    }

    mutation.mutate(body, {
      onSuccess: (response) => setResult(response),
      onError: (err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          // Address errors come back as "address.line1" etc.
          setFieldErrors(
            Object.fromEntries(
              err.details.map((d) => [
                d.field.replace(/^address\./, ""),
                d.message,
              ]),
            ),
          );
        } else {
          setError("Could not reach the server. Try again.");
        }
      },
    });
  }

  if (result) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success" className="">
          {result.changed
            ? "Customer details updated."
            : "Nothing needed changing."}
        </FormAlert>
        <DeliveryResult result={result} />
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    );
  }

  const fieldClass = (field: string) =>
    `input-field ${fieldErrors[field] ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="edit-name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className={fieldClass("name")}
          />
          <FieldError message={fieldErrors.name} />
        </div>
        <div>
          <label htmlFor="edit-phone" className="block text-sm font-medium">
            Phone
          </label>
          <input
            id="edit-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass("phone")}
          />
          <FieldError message={fieldErrors.phone} />
        </div>
        <div>
          <label htmlFor="edit-email" className="block text-sm font-medium">
            Email <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="edit-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass("email")}
          />
          <FieldError message={fieldErrors.email} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="edit-line1" className="block text-sm font-medium">
            Address
          </label>
          <input
            id="edit-line1"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="House, street"
            className={fieldClass("line1")}
          />
          <FieldError message={fieldErrors.line1} />
        </div>
        <div>
          <label htmlFor="edit-line2" className="block text-sm font-medium">
            Address line 2{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="edit-line2"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            className={fieldClass("line2")}
          />
        </div>
        <div>
          <label htmlFor="edit-area" className="block text-sm font-medium">
            Area <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="edit-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={fieldClass("area")}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="edit-city" className="block text-sm font-medium">
            City
          </label>
          <select
            id="edit-city"
            value={cityChoice}
            onChange={(e) => setCityChoice(e.target.value)}
            disabled={cities.isPending}
            className={fieldClass("cityId")}>
            {cities.isPending && <option>Loading cities…</option>}
            {cities.data &&
              groupByProvince(cities.data.cities).map((group) => (
                <optgroup key={group.province} label={group.province}>
                  {group.cities.map((city) => (
                    <option key={city._id} value={city._id}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            <option value={OTHER_CITY}>City not listed (type it below)</option>
          </select>
          {cities.isError && (
            <p className="mt-1.5 text-xs text-danger">
              Could not load the city list. Type the city below.
            </p>
          )}
          <FieldError message={fieldErrors.cityId} />
        </div>

        {cityChoice === OTHER_CITY && (
          <>
            <div>
              <label
                htmlFor="edit-city-name"
                className="block text-sm font-medium">
                City name
              </label>
              <input
                id="edit-city-name"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                className={fieldClass("cityName")}
              />
              <FieldError message={fieldErrors.cityName} />
            </div>
            <div>
              <label
                htmlFor="edit-province"
                className="block text-sm font-medium">
                Province
              </label>
              <select
                id="edit-province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className={fieldClass("province")}>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.province} />
            </div>
          </>
        )}
      </div>

      {addressChanged && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm">
          <input
            type="checkbox"
            checked={recalculate}
            onChange={(e) => setRecalculate(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]"
          />
          <span>
            <span className="block font-medium">
              Use the new city's delivery charge
            </span>
            <span className="block text-xs text-muted">
              Leave unticked to keep {formatRs(order.pricing.deliveryCharge)},
              the charge agreed at checkout.
            </span>
          </span>
        </label>
      )}

      <label htmlFor="edit-note" className="mt-4 block text-sm font-medium">
        Why the change?{" "}
        <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id="edit-note"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Customer gave a new address on the call"
        className="input-field"
      />

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary gap-2">
          {mutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Save changes
        </button>
      </div>
    </form>
  );
}

export default function EditContactDialog({
  open,
  order,
  onClose,
}: FormProps & { open: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit customer details"
      description="Only before packing. Items can't be changed here: cancel and place a new order instead.">
      <EditContactForm order={order} onClose={onClose} />
    </Modal>
  );
}
