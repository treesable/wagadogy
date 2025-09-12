import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { isRefreshTokenError } from '@/utils/authUtils';

interface Props {
  children: ReactNode;
  onAuthError?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('AuthErrorBoundary caught an error:', error, errorInfo);
    
    // Check if this is a refresh token error
    if (isRefreshTokenError(error)) {
      console.log('Refresh token error caught by error boundary');
      this.props.onAuthError?.();
    }
  }

  render() {
    if (this.state.hasError) {
      const isAuthError = this.state.error && isRefreshTokenError(this.state.error);
      
      return (
        <View style={styles.container}>
          <Text style={styles.title}>
            {isAuthError ? 'Authentication Error' : 'Something went wrong'}
          </Text>
          <Text style={styles.message}>
            {isAuthError 
              ? 'Your session has expired. Please sign in again.'
              : 'An unexpected error occurred. Please try again.'
            }
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              this.setState({ hasError: false, error: null });
              if (isAuthError) {
                this.props.onAuthError?.();
              }
            }}
          >
            <Text style={styles.buttonText}>
              {isAuthError ? 'Sign In Again' : 'Try Again'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});