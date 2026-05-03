import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generatePQCKeyPair } from '@/lib/crypto';
import { saveAndLockPrivateKey, unlockVault } from '@/lib/keyManager';
import { supabase } from '@/utils/supabase/client';
import { Lock } from 'lucide-react';
import React, { useState } from 'react';

interface AuthProps {
    onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;

                if (data.user) {
                    const { publicKey, privateKey } = await generatePQCKeyPair();

                    let profileCreated = false;
                    let retry = 10;
                    while (retry-- > 0) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('id', data.user.id)
                            .single();

                        if (profile) {
                            profileCreated = true;
                            break;
                        }
                        console.log("Waiting...");
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    if (!profileCreated) {
                        throw new Error("Critical Error: Database trigger failed to create user profile.");
                    }

                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update({ pqc_public_key: publicKey })
                        .eq('id', data.user.id);

                    if (profileError) throw profileError;

                    await saveAndLockPrivateKey(data.user.id, password, privateKey);
                    localStorage.setItem(`pqc_private_key_${data.user.id}`, privateKey);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                if (data.user) {
                    const decryptedPrivateKey = await unlockVault(data.user.id, password);

                    if (!decryptedPrivateKey) {
                        throw new Error('Could not unlock key vault. Incorrect password or missing key on this device.');
                    }

                    localStorage.setItem(`pqc_private_key_${data.user.id}`, decryptedPrivateKey as string);
                }

                onAuthSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 justify-center items-center p-4">
            <Card className="w-full max-w-md p-8 shadow-2xl border-0 bg-gradient-to-b from-white to-slate-50">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                        <Lock className="text-2xl">🔐</Lock>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                        Quantum Secure Chat
                    </h1>
                    <p className="text-slate-600 text-sm">Post-quantum encrypted messaging</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <Label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                            Email Address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="alice@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                        />
                    </div>

                    <div>
                        <Label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                            Password
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                        />
                    </div>

                    {error && (
                        <div className={`p-4 rounded-lg text-sm font-medium animate-fadeIn ${error.includes('Check')
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                            }`}>
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
                    </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-200">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                        }}
                        className="w-full text-center text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors duration-200"
                    >
                        {isSignUp ? (
                            <>
                                Already have an account?{' '}
                                <span className="text-blue-600 hover:underline">Sign In</span>
                            </>
                        ) : (
                            <>
                                Don't have an account?{' '}
                                <span className="text-blue-600 hover:underline">Create one</span>
                            </>
                        )}
                    </button>
                </div>
            </Card>
        </div>
    );
}
