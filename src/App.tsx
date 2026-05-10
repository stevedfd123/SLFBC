/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cross, 
  Book, 
  Users, 
  MapPin, 
  Phone, 
  Mail, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  ChevronRight, 
  ChevronDown,
  LogOut,
  LogIn,
  Languages,
  Info,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';

// --- Types ---

interface Member {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  joinedAt: any;
  createdBy: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Constants ---

const CHURCH_NAME = "Sri Lanka Family Bible Church";
const CHURCH_ADDRESS = "No. 122 1/1, W.A. Silva Mawatha, Colombo 06";
const PASTOR_NAME = "Rev. Pastor J. Christopher Gnanaraja";

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('{"error":')) {
        try {
          const errInfo: FirestoreErrorInfo = JSON.parse(event.error.message);
          setErrorMsg(`Firestore Error: ${errInfo.operationType} on ${errInfo.path}. ${errInfo.error}`);
        } catch {
          setErrorMsg(event.error.message);
        }
        setHasError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-red-200">
          <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'members' | 'bible'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Connection test
  useEffect(() => {
    if (isAuthReady) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      };
      testConnection();
    }
  }, [isAuthReady]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
        {/* Navigation */}
        <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center gap-2">
                  <Cross className="h-8 w-8 text-emerald-700" />
                  <span className="font-serif font-bold text-lg hidden sm:block">SLFBC</span>
                </div>
                <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                  <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')}>Home</NavButton>
                  <NavButton active={activeTab === 'members'} onClick={() => setActiveTab('members')}>Members</NavButton>
                  <NavButton active={activeTab === 'bible'} onClick={() => setActiveTab('bible')}>Bible</NavButton>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-3">
                    <img src={user.photoURL || ""} alt={user.displayName || ""} className="h-8 w-8 rounded-full border border-stone-200" referrerPolicy="no-referrer" />
                    <button onClick={handleLogout} className="text-stone-500 hover:text-stone-900 transition-colors">
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={handleLogin} className="flex items-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors">
                    <LogIn className="h-4 w-4" />
                    <span className="text-sm font-medium">Login</span>
                  </button>
                )}
                <button 
                  className="sm:hidden text-stone-500"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                  {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="sm:hidden bg-white border-t border-stone-100"
              >
                <div className="px-2 pt-2 pb-3 space-y-1">
                  <MobileNavButton active={activeTab === 'home'} onClick={() => { setActiveTab('home'); setIsMobileMenuOpen(false); }}>Home</MobileNavButton>
                  <MobileNavButton active={activeTab === 'members'} onClick={() => { setActiveTab('members'); setIsMobileMenuOpen(false); }}>Members</MobileNavButton>
                  <MobileNavButton active={activeTab === 'bible'} onClick={() => { setActiveTab('bible'); setIsMobileMenuOpen(false); }}>Bible</MobileNavButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HomeSection />
              </motion.div>
            )}
            {activeTab === 'members' && (
              <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MembersSection user={user} />
              </motion.div>
            )}
            {activeTab === 'bible' && (
              <motion.div key="bible" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <BibleSection />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-stone-200 py-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Cross className="h-10 w-10 text-emerald-700 mx-auto mb-4" />
            <h3 className="font-serif font-bold text-xl mb-2">{CHURCH_NAME}</h3>
            <p className="text-stone-500 text-sm max-w-md mx-auto">
              Spreading the Word of God in Colombo and beyond. Join us for worship and fellowship.
            </p>
            <div className="mt-8 pt-8 border-t border-stone-100 text-stone-400 text-xs">
              &copy; {new Date().getFullYear()} Sri Lanka Family Bible Church. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

function NavButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
        active 
          ? "border-emerald-700 text-stone-900" 
          : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"
      }`}
    >
      {children}
    </button>
  );
}

function MobileNavButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
        active 
          ? "bg-emerald-50 text-emerald-700" 
          : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
      }`}
    >
      {children}
    </button>
  );
}

// --- Section Components ---

function HomeSection() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-emerald-900 text-white py-24 px-8 text-center shadow-2xl">
        <div className="absolute inset-0 opacity-20">
          <img 
            src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&q=80&w=2000" 
            alt="Church Background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Cross className="h-16 w-16 mx-auto mb-6 text-emerald-400" />
          </motion.div>
          <h1 className="text-4xl sm:text-6xl font-serif font-bold mb-6 leading-tight">
            Welcome to <br /> {CHURCH_NAME}
          </h1>
          <p className="text-xl text-emerald-100 mb-8 font-light italic">
            "For where two or three are gathered together in my name, there am I in the midst of them."
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">Colombo 06</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
              <Users className="h-4 w-4" />
              <span className="text-sm">Family Fellowship</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
          <Info className="h-10 w-10 text-emerald-700 mb-4" />
          <h3 className="text-xl font-serif font-bold mb-3">About Our Church</h3>
          <p className="text-stone-600 leading-relaxed">
            The Sri Lanka Family Bible Church is a community of believers dedicated to the teachings of Jesus Christ. We focus on family values, biblical truth, and community service.
          </p>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
          <Users className="h-10 w-10 text-emerald-700 mb-4" />
          <h3 className="text-xl font-serif font-bold mb-3">Our Leadership</h3>
          <p className="text-stone-600 leading-relaxed">
            Headed by <strong>{PASTOR_NAME}</strong>, our church provides spiritual guidance and support to all members of our congregation.
          </p>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
          <MapPin className="h-10 w-10 text-emerald-700 mb-4" />
          <h3 className="text-xl font-serif font-bold mb-3">Visit Us</h3>
          <p className="text-stone-600 leading-relaxed">
            {CHURCH_ADDRESS}.<br />
            We welcome you to join our Sunday services and weekly prayer meetings.
          </p>
        </div>
      </div>

      {/* Contact Section */}
      <div className="bg-stone-100 rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6">
          <h2 className="text-3xl font-serif font-bold">Get in Touch</h2>
          <p className="text-stone-600">
            Have questions or need prayer? Reach out to us. We are here to support you in your spiritual journey.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-stone-700">
              <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Phone className="h-5 w-5 text-emerald-700" />
              </div>
              <span>+94 11 234 5678</span>
            </div>
            <div className="flex items-center gap-4 text-stone-700">
              <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Mail className="h-5 w-5 text-emerald-700" />
              </div>
              <span>info@slfbc.org</span>
            </div>
          </div>
        </div>
        <div className="flex-1 w-full h-64 bg-stone-200 rounded-2xl overflow-hidden shadow-inner relative">
           {/* Placeholder for a map */}
           <div className="absolute inset-0 flex items-center justify-center text-stone-400 flex-col gap-2">
             <MapPin className="h-12 w-12" />
             <span className="text-sm font-medium">Map View: Colombo 06</span>
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function MembersSection({ user }: { user: any }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'members'), orderBy('joinedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(membersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });
    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingMember) {
        await updateDoc(doc(db, 'members', editingMember.id), {
          ...formData,
        });
        setEditingMember(null);
      } else {
        await addDoc(collection(db, 'members'), {
          ...formData,
          joinedAt: serverTimestamp(),
          createdBy: user.uid
        });
      }
      setFormData({ fullName: '', email: '', phone: '', address: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, editingMember ? OperationType.UPDATE : OperationType.CREATE, 'members');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      await deleteDoc(doc(db, 'members', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'members');
    }
  };

  const startEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      address: member.address
    });
    setIsAdding(true);
  };

  const filteredMembers = members.filter(m => 
    m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="h-20 w-20 bg-stone-100 rounded-full flex items-center justify-center">
          <Users className="h-10 w-10 text-stone-400" />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-serif font-bold mb-2">Member Directory</h2>
          <p className="text-stone-500 mb-8">Please log in with your Google account to access and manage the church member directory.</p>
          <button 
            onClick={() => {
              const provider = new GoogleAuthProvider();
              signInWithPopup(auth, provider);
            }}
            className="bg-emerald-700 text-white px-8 py-3 rounded-xl font-medium hover:bg-emerald-800 transition-all shadow-lg hover:shadow-emerald-200"
          >
            Login to Access
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold">Member Directory</h2>
          <p className="text-stone-500">Manage church member information and contact details.</p>
        </div>
        <button 
          onClick={() => { setIsAdding(true); setEditingMember(null); setFormData({ fullName: '', email: '', phone: '', address: '' }); }}
          className="flex items-center justify-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-800 transition-all shadow-md"
        >
          <Plus className="h-5 w-5" />
          Add New Member
        </button>
      </div>

      {/* Search and Filter */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
        <input 
          type="text" 
          placeholder="Search members by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
        />
      </div>

      {/* Member List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence>
          {filteredMembers.map(member => (
            <motion.div 
              key={member.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex items-start justify-between gap-4 group hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-700 font-bold text-lg">
                  {member.fullName.charAt(0)}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-lg">{member.fullName}</h4>
                  <div className="flex items-center gap-2 text-stone-500 text-sm">
                    <Mail className="h-3 w-3" />
                    <span>{member.email}</span>
                  </div>
                  {member.phone && (
                    <div className="flex items-center gap-2 text-stone-500 text-sm">
                      <Phone className="h-3 w-3" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {member.address && (
                    <div className="flex items-center gap-2 text-stone-500 text-sm">
                      <MapPin className="h-3 w-3" />
                      <span className="line-clamp-1">{member.address}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => startEdit(member)}
                  className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(member.id)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
          <Users className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500">No members found matching your search.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              onClick={() => setIsAdding(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-serif font-bold">
                    {editingMember ? 'Edit Member' : 'Add New Member'}
                  </h3>
                  <button onClick={() => setIsAdding(false)} className="text-stone-400 hover:text-stone-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Full Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">Email Address</label>
                    <input 
                      required
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-700">Phone Number</label>
                      <input 
                        type="tel" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="+94 ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-700">Address</label>
                      <input 
                        type="text" 
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="Colombo 06"
                      />
                    </div>
                  </div>
                  <div className="pt-4 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 px-6 py-3 border border-stone-200 rounded-xl font-medium hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-100"
                    >
                      {editingMember ? 'Save Changes' : 'Add Member'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BibleSection() {
  const [verse, setVerse] = useState<{ eng: string, sin: string, tam: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('John 3:16');

  const fetchVerse = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide the Bible verse "${query}" from the Anglican Bible in three languages: English, Sinhala, and Tamil. Format the output as a JSON object with keys "eng", "sin", and "tam".`,
        config: { responseMimeType: "application/json" }
      });
      
      const data = JSON.parse(response.text);
      setVerse(data);
    } catch (error) {
      console.error("Failed to fetch verse:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerse('John 3:16');
  }, [fetchVerse]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-12"
    >
      <div className="text-center space-y-4">
        <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
          <Book className="h-8 w-8" />
        </div>
        <h2 className="text-3xl font-serif font-bold">Multilingual Bible</h2>
        <p className="text-stone-500 max-w-xl mx-auto">
          Explore the Word of God in English, Sinhala, and Tamil. Search for any verse or passage.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Book className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchVerse(searchQuery)}
            placeholder="Enter verse (e.g., Psalm 23:1)"
            className="w-full pl-12 pr-4 py-4 bg-white border border-stone-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <button 
          onClick={() => fetchVerse(searchQuery)}
          disabled={loading}
          className="bg-emerald-700 text-white px-8 py-4 rounded-2xl font-medium hover:bg-emerald-800 transition-all shadow-md disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Verse Display */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center py-20"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
          </motion.div>
        ) : verse ? (
          <motion.div 
            key="verse"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-6"
          >
            <VerseCard title="English" content={verse.eng} lang="en" />
            <VerseCard title="Sinhala (සිංහල)" content={verse.sin} lang="si" />
            <VerseCard title="Tamil (தமிழ்)" content={verse.tam} lang="ta" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Resources */}
      <div className="bg-stone-100 rounded-3xl p-8">
        <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
          <Languages className="h-5 w-5 text-emerald-700" />
          Bible Resources
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ResourceLink title="Anglican Communion" url="https://www.anglicancommunion.org/" />
          <ResourceLink title="Bible Society of Sri Lanka" url="https://www.biblesociety.lk/" />
          <ResourceLink title="Daily Devotionals" url="https://www.churchofengland.org/prayer-and-worship/join-us-service-daily-prayer" />
          <ResourceLink title="Online Bible Study" url="https://www.biblegateway.com/" />
        </div>
      </div>
    </motion.div>
  );
}

function VerseCard({ title, content, lang }: { title: string, content: string, lang: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
          {title}
        </span>
        <Languages className="h-4 w-4 text-stone-300" />
      </div>
      <p className={`text-xl sm:text-2xl text-stone-800 leading-relaxed ${lang === 'si' || lang === 'ta' ? 'font-medium' : 'font-serif italic'}`}>
        {content}
      </p>
    </div>
  );
}

function ResourceLink({ title, url }: { title: string, url: string }) {
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center justify-between p-4 bg-white rounded-xl border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
    >
      <span className="font-medium text-stone-700 group-hover:text-emerald-700">{title}</span>
      <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-500" />
    </a>
  );
}
