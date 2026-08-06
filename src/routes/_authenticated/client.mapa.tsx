import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/client/mapa')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/client/mapa"!</div>
}
