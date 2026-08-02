export function Features() {
  return (
    <section className="border-t py-16">
      <div className="container">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">Custom aliases</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Name your links instead of using random codes — like smarturl.app/my-page.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Click analytics</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              See visits, unique visitors, countries, devices and referrers for every link.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Expiry &amp; limits</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Set an end date or a click budget. Links deactivate themselves when reached.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
