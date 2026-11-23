import React, { useState } from 'react'
import { ExampleRequest, EXAMPLE_REQUESTS, HttpMethod } from './types'

interface Props {
  onLoad: (example: ExampleRequest) => void
}

const METHOD_BADGE: Record<HttpMethod, string> = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700'
}

export const ExampleRequests: React.FC<Props> = ({ onLoad }) => {
  const categories = [...new Set(EXAMPLE_REQUESTS.map((e) => e.category))]
  const [activeCategory, setActiveCategory] = useState<string>(categories[0])

  const visible = EXAMPLE_REQUESTS.filter((e) => e.category === activeCategory)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-4 py-2.5 border-b border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-2">Example requests</p>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeCategory === cat
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-gray-300 text-gray-600 hover:border-emerald-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {visible.map((example) => (
          <li
            key={example.id}
            className="px-4 py-3 hover:bg-gray-50 flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded ${METHOD_BADGE[example.request.method]}`}
                >
                  {example.request.method}
                </span>
                <span className="text-sm font-medium text-gray-800">{example.name}</span>
              </div>
              <p className="text-xs text-gray-500">{example.description}</p>
              <p className="text-xs font-mono text-gray-400 mt-0.5 truncate">
                {example.request.url}
              </p>
            </div>
            <button
              onClick={() => onLoad(example)}
              className="shrink-0 text-xs text-emerald-600 hover:text-emerald-800 font-medium border border-emerald-200 hover:border-emerald-400 rounded px-2 py-1 transition-colors"
            >
              Load
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
