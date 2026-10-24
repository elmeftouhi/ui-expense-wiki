import React from 'react'
import { Tag } from 'lucide-react'
import { ICON_MAP } from './categoryIcons'

interface CategoryIconProps {
  name?: string
  className?: string
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-4 h-4' }) => {
  const IconComponent = (name && ICON_MAP[name]) || Tag
  return <IconComponent className={className} />
}
