import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/client/insights')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/client/insights"!</div>
}
