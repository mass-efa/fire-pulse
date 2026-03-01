import { useState, useCallback } from 'react';
import api from '../lib/api';

export function usePortfolio() {
  const [holdings, setHoldings] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/portfolio');
      setHoldings(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  }, []);

  const addHolding = async ({ ticker, shares, avg_cost, asset_type }) => {
    const { data } = await api.post('/portfolio', { ticker, shares, avg_cost, asset_type });
    setHoldings(prev => [...prev, data]);
    return data;
  };

  const updateHolding = async (id, updates) => {
    const { data } = await api.put(`/portfolio/${id}`, updates);
    setHoldings(prev => prev.map(h => h.id === id ? data : h));
    return data;
  };

  const deleteHolding = async (id) => {
    await api.delete(`/portfolio/${id}`);
    setHoldings(prev => prev.filter(h => h.id !== id));
  };

  return { holdings, loading, error, fetchHoldings, addHolding, updateHolding, deleteHolding };
}
