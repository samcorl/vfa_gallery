import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import ErrorFallback from './ErrorFallback'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Error Boundary caught an error:')
      console.error(error)
      console.error('Error Info:', errorInfo)
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorFallback error={this.state.error} resetErrorBoundary={this.resetError} />
    }

    return this.props.children
  }
}
