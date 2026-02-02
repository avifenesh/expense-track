'use client'

import Markdown from 'react-markdown'

interface ArticleContentProps {
  content: string
}

export function ArticleContent({ content }: ArticleContentProps) {
  return <Markdown>{content}</Markdown>
}
