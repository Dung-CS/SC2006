/**
 * D-Fence — Not Found screen (REQUIREMENTS.md 11.2.24).
 * Stereotype: <<boundary>>. Traces: 11.2.24, 2.3.7, 10.5.6.
 *
 * Distinct from Not Authorised in wording but not in what it reveals. The guard answers Not Found
 * for an unknown URL *before* it considers the role, so an anonymous visitor cannot map the private
 * routes by comparing which addresses say "not authorised" and which say "not found".
 */
import { SearchX } from 'lucide-react';
import { link } from '../../components/Link';
import { homeFor } from '../../app/RouteGuard';
import { ScreenProps } from '../ScreenProps';

export function NotFoundScreen(props: ScreenProps): JSX.Element {
  const home = props.principal === null ? '/' : homeFor(props.principal.role);
  return (
    <section data-screen="NotFound" data-requirement="11.2.24" className="mx-auto mt-8 max-w-md rounded-3xl border border-line bg-surface p-8 shadow-sm">
      <SearchX aria-hidden="true" className="mb-3 size-8 text-accent" />
      <h1>Not found</h1>
      <p>That address does not exist.</p>
      <a href={home} onClick={link(props, home)} className="inline-flex min-h-11 items-center font-semibold">
        Back to {props.principal === null ? 'the start' : 'your home screen'}
      </a>
    </section>
  );
}
