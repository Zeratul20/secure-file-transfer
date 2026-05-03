import { ChatProvider } from '@/lib/chatContext';
import { supabase } from '@/lib/supabaseClient';
import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import './App.css';
import Auth from './components/Auth';
import ChatLayout from './components/ChatLayout';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 justify-center items-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl animate-pulse-soft">
            <Lock className="text-3xl">🔐</Lock>
          </div>
          <p className="text-white text-lg font-semibold">Loading your secure chat...</p>
          <div className="mt-4 flex justify-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => { }} />;
  }

  return (
    <ErrorBoundary>
      <ChatProvider>
        <ChatLayout user={user} />
      </ChatProvider>
    </ErrorBoundary>
  );
}

export default App
