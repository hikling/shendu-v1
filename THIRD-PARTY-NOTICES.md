# Third-party UI components

`shendu/ui/components/ui/` contains shadcn/ui component source imported with the official `shadcn@4.23.0` CLI, `new-york` style, Radix primitives, JavaScript/React configuration. Local adapters preserve Shendu's typography, palettes and existing form contracts. Original source: <https://github.com/shadcn-ui/ui>. Its MIT license is retained in [the component directory](shendu/ui/components/ui/LICENSE.md).

The browser build bundles React, React DOM, Radix UI, React DayPicker, date-fns, Sonner, Lucide, class-variance-authority, clsx and tailwind-merge, with their required utilities. Exact versions and transitive dependencies are recorded in `shendu/package-lock.json`. Their original licenses are included automatically for every package that contributes code to the build, in the deployed `/ui/licenses.txt`. The build fails if a bundled package has no discoverable license notice, so its terms can be reviewed explicitly.

Vite, Tailwind CSS and the Tailwind Vite plugin are build tools; jsdom supports isolated component tests. Their notices remain in their npm package distributions. No asset in the existing illustration collection changes ownership because of this migration; its individual provenance files still apply.

`react-remove-scroll-bar@2.3.8` omits its license file from the npm tarball. The MIT notice from its [upstream repository](https://github.com/theKashey/react-remove-scroll-bar/blob/master/LICENSE) is retained in `shendu/ui/licenses/` and included in the generated notices.
