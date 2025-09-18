import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { testApiConnectivity, trpc } from '@/lib/trpc';

interface TestResult {
  test: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export default function ApiTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (test: string, success: boolean, data?: any, error?: string) => {
    const result: TestResult = {
      test,
      success,
      data,
      error,
      timestamp: new Date().toISOString()
    };
    setResults(prev => [result, ...prev]);
  };

  const testHealthEndpoint = async () => {
    try {
      console.log('[ApiTest] Testing health endpoint...');
      const result = await testApiConnectivity();
      addResult('Health Endpoint', result.success, result.data, result.error);
    } catch (error: any) {
      console.error('[ApiTest] Health test error:', error);
      addResult('Health Endpoint', false, null, error?.message || 'Unknown error');
    }
  };

  const testTrpcEndpoint = async () => {
    try {
      console.log('[ApiTest] Testing tRPC endpoint...');
      const client = trpc.useUtils();
      const result = await client.example.test.fetch();
      addResult('tRPC Test Endpoint', true, result);
    } catch (error: any) {
      console.error('[ApiTest] tRPC test error:', error);
      addResult('tRPC Test Endpoint', false, null, error?.message || 'Unknown error');
    }
  };

  const testEnvironmentVars = () => {
    const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    addResult('Environment Variables', true, {
      EXPO_PUBLIC_RORK_API_BASE_URL: baseUrl || 'NOT SET',
      EXPO_PUBLIC_SUPABASE_URL: supabaseUrl || 'NOT SET',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseKey ? 'SET (length: ' + supabaseKey.length + ')' : 'NOT SET'
    });
  };

  const runAllTests = async () => {
    setIsLoading(true);
    setResults([]);
    
    try {
      testEnvironmentVars();
      await testHealthEndpoint();
      await testTrpcEndpoint();
    } catch (error) {
      console.error('[ApiTest] Error running tests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API Connectivity Test</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Testing...' : 'Run All Tests'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {results.map((result) => (
          <View key={result.timestamp} style={[
            styles.resultItem,
            result.success ? styles.successItem : styles.errorItem
          ]}>
            <View style={styles.resultHeader}>
              <Text style={styles.testName}>{result.test}</Text>
              <Text style={[
                styles.status,
                result.success ? styles.successText : styles.errorText
              ]}>
                {result.success ? '✅ SUCCESS' : '❌ FAILED'}
              </Text>
            </View>
            
            <Text style={styles.timestamp}>
              {new Date(result.timestamp).toLocaleTimeString()}
            </Text>
            
            {result.error && (
              <Text style={styles.errorMessage}>
                Error: {result.error}
              </Text>
            )}
            
            {result.data && (
              <Text style={styles.dataText}>
                Data: {JSON.stringify(result.data, null, 2)}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultsContainer: {
    flex: 1,
  },
  resultItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  successItem: {
    borderLeftColor: '#4CAF50',
  },
  errorItem: {
    borderLeftColor: '#F44336',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  status: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  successText: {
    color: '#4CAF50',
  },
  errorText: {
    color: '#F44336',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    color: '#F44336',
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 4,
    marginBottom: 10,
  },
  dataText: {
    fontSize: 12,
    color: '#333',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
});