import type { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: number
  icon: LucideIcon
}

export function StatsCard({ title, value, icon: Icon }: StatsCardProps) {
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 h-28 flex flex-col justify-between transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-default">
      <div className="absolute top-4 right-4">
        <Icon className="h-8 w-8 text-white/60" />
      </div>
      <p className="text-sm font-medium text-white/80">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  )
}
