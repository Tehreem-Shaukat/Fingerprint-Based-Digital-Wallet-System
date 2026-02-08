const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Transfer funds endpoint
router.post('/transfer', async (req, res) => {
  try {
    const { sender, receiver, amount } = req.body;

    // Validate input
    if (!sender || !receiver || amount == null) {
      return res.status(400).json({
        error: 'Missing required fields: sender, receiver, amount'
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        error: 'Amount must be positive'
      });
    }

    console.log(`Transfer request: ${sender} → ${receiver}, amount: ${amount}`);

    // Call the SQL function
    const { data, error } = await supabase.rpc('transfer_funds', {
      p_sender: sender,
      p_receiver: receiver,
      p_amount: parseInt(amount, 10)
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Transfer result:', data);

    const result = Array.isArray(data) ? data[0] : data;

    if (!result || !result.success) {
      return res.status(400).json({ error: result ? result.message : 'Transfer failed' });
    }

    return res.json({
      success: true,
      message: result.message,
      transactionId: result.transaction_id || result.transaction_id
    });

  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json({
      error: 'Internal server error: ' + error.message
    });
  }
});

// Get transaction history
router.get('/transactions/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`sender.eq.${username},receiver.eq.${username}`)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      transactions: data || []
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get wallet balance
router.get('/wallet/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      throw error;
    }

    res.json({
      success: true,
      wallet: data
    });

  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all wallets (for testing)
router.get('/wallets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('username, balance, createdAt')
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      wallets: data || []
    });

  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
