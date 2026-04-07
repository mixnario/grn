/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Plus, 
  TrendingUp, 
  Flame, 
  Smile, 
  ThumbsUp, 
  Zap,
  X,
  RefreshCw,
  Stethoscope,
  Scissors,
  Syringe,
  MoreVertical,
  Edit2,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  deleteDoc, 
  Timestamp,
  increment,
  getDocFromServer
} from 'firebase/firestore';
import { db } from './firebase';

// --- Types ---

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
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Character = 'RICO' | 'BORI';

interface Comment {
  character: Character;
  text: string;
}

interface Post {
  id: string;
  author: string;
  savedItem: string;
  action: string;
  message: string;
  imageUrl?: string;
  memeText?: string;
  characterComment: Comment;
  likes: number;
  reactions: {
    clap: number;
    fire: number;
  };
  createdAt: Date;
  isSample?: boolean;
}

// --- Constants & Helpers ---

// Rico (Cat) - 🐱
// Bori (Dog) - 🐶

const RICO_EMOJI = '🐱';
const BORI_EMOJI = '🐶';

const RICO_COMMENTS = [
  "거즈 한 장도 아끼는 당신, 진정한 수의 테크니션입니다.",
  "알코올 솜 낭비 차단 완료. 아주 효율적인 진료 보조군요.",
  "소모품 절약은 병원 경영의 기초입니다. 훌륭해요.",
  "데이터상으로도 아주 경제적인 행동입니다. 리스펙.",
  "테이프 길이 조절이 아주 이성적이네요. 만족스럽습니다.",
  "일회용 패드 활용도가 100%네요. 완벽한 분석입니다.",
  "낭비되는 소모품을 정확히 짚어내셨네요. 칭찬합니다."
];

const BORI_COMMENTS = [
  "나 원래 거즈 팍팍 쓰는데… 오늘은 참음! 칭찬해줘!",
  "이건 좀 잘했다 인정! 나도 알코올 솜 아껴볼까?",
  "귀찮지만 테이프 아껴 써봅니다. 생각보다 괜찮네?",
  "오… 주사기 캡을 이렇게도 활용하다니! 신기함!",
  "보리보리하게 절약 성공! 우리 병원 부자 되겠다!",
  "그냥 버릴 뻔했는데 멈췄음! 휴~ 다행이다!",
  "절약 전문가 냄새가 나는데? 킁킁. 나도 따라할래!"
];

const MEME_TEMPLATES = [
  "거즈 한 장으로 수술 끝",
  "알코올 솜 1/4 조각의 기적",
  "테이프는 딱 3cm만",
  "주사기 캡은 비의료용으로 재탄생",
  "일회용 패드, 깨끗한 쪽은 한 번 더",
  "내 손이 저울이다 (정량 사용)",
  "낭비는 없다, 오직 절약뿐",
  "이게 바로 베테랑의 손길",
  "병원 비품은 내 물건처럼",
  "티끌 모아 수술비 (아님)"
];

const SAMPLE_POSTS: Post[] = [
  {
    id: '1',
    author: '김테크',
    savedItem: '멸균 거즈',
    action: '필요한 만큼만 소분해서 사용',
    message: '무심코 한 뭉치씩 꺼내던 거즈, 오늘은 딱 필요한 만큼만! 5장 아꼈습니다.',
    memeText: '거즈 한 장으로 수술 끝',
    characterComment: { character: 'RICO', text: '거즈 한 장도 아끼는 당신, 진정한 수의 테크니션입니다.' },
    likes: 15,
    reactions: { clap: 8, fire: 5 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
    isSample: true,
  },
  {
    id: '2',
    author: '이원장',
    savedItem: '알코올 솜',
    action: '작은 상처엔 반으로 잘라 사용',
    message: '작은 상처 소독할 때 큰 솜 다 쓰기 아깝더라고요. 반으로 톡!',
    memeText: '알코올 솜 1/4 조각의 기적',
    characterComment: { character: 'BORI', text: '이건 좀 잘했다 인정! 나도 알코올 솜 아껴볼까?' },
    likes: 22,
    reactions: { clap: 12, fire: 3 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    isSample: true,
  },
  {
    id: '3',
    author: '박선생',
    savedItem: '의료용 테이프',
    action: '눈대중 말고 정확히 컷팅',
    message: '길게 뽑아서 버려지던 테이프, 오늘은 딱 맞게 잘랐어요.',
    memeText: '테이프는 딱 3cm만',
    characterComment: { character: 'RICO', text: '테이프 길이 조절이 아주 이성적이네요. 만족스럽습니다.' },
    likes: 10,
    reactions: { clap: 5, fire: 2 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
    isSample: true,
  },
  {
    id: '4',
    author: '최간호',
    savedItem: '일회용 패드',
    action: '오염 안 된 부분은 바닥 깔개로 재활용',
    message: '살짝 묻은 패드, 버리기 아까워서 청소용으로 한 번 더 썼어요.',
    memeText: '일회용 패드, 깨끗한 쪽은 한 번 더',
    characterComment: { character: 'BORI', text: '나 원래 거즈 팍팍 쓰는데… 오늘은 참음! 칭찬해줘!' },
    likes: 18,
    reactions: { clap: 6, fire: 4 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
    isSample: true,
  },
  {
    id: '5',
    author: '정실장',
    savedItem: '수술용 장갑',
    action: '사이즈 미스 방지 (신중히 선택)',
    message: '급하다고 아무거나 집었다가 버리는 일 없게! 내 사이즈 딱 확인.',
    memeText: '이게 바로 베테랑의 손길',
    characterComment: { character: 'RICO', text: '소모품 절약은 병원 경영의 기초입니다. 훌륭해요.' },
    likes: 35,
    reactions: { clap: 25, fire: 15 },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40),
    isSample: true,
  }
];

// --- Components ---

const CharacterAvatar = ({ character, size = 'md' }: { character: Character, size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl'
  };
  
  return (
    <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden border-2 transition-transform hover:scale-110 ${character === 'RICO' ? 'border-orange-200 bg-orange-50' : 'border-brown-200 bg-white'}`}>
      {character === 'RICO' ? RICO_EMOJI : BORI_EMOJI}
    </div>
  );
};

const SpeechBubble = ({ character, text }: { character: Character, text: string }) => {
  return (
    <div className={`flex items-start gap-3 mt-4 ${character === 'RICO' ? 'flex-row' : 'flex-row-reverse'}`}>
      <CharacterAvatar character={character} size="sm" />
      <div className={`relative p-4 rounded-2xl text-sm shadow-sm border ${
        character === 'RICO' 
          ? 'bg-orange-50 text-orange-900 border-orange-100 rounded-tl-none' 
          : 'bg-white text-[#483729] border-gray-100 rounded-tr-none'
      }`}>
        <p className="font-black mb-1 text-xs">{character === 'RICO' ? '리코' : '보리'}</p>
        <p className="leading-relaxed">{text}</p>
      </div>
    </div>
  );
};

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newPost, setNewPost] = useState({
    author: '',
    savedItem: '',
    action: '',
    message: '',
    memeText: ''
  });

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Connection Test & Initialization
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
    setIsReady(true);
  }, []);

  // Real-time Data Fetching
  useEffect(() => {
    if (!isReady) return;

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Post;
      });
      setPosts([...fetchedPosts, ...SAMPLE_POSTS.slice(0, 3)]);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, [isReady]);

  const generateMeme = () => {
    const randomMeme = MEME_TEMPLATES[Math.floor(Math.random() * MEME_TEMPLATES.length)];
    if (editingPost) {
      setEditingPost({ ...editingPost, memeText: randomMeme });
    } else {
      setNewPost({ ...newPost, memeText: randomMeme });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPost) {
        if (editingPost.isSample) {
          // Update sample post locally
          setPosts(posts.map(p => p.id === editingPost.id ? editingPost : p));
          setEditingPost(null);
          setIsFormOpen(false);
          return;
        }

        const postRef = doc(db, 'posts', editingPost.id);
        await updateDoc(postRef, {
          author: editingPost.author,
          savedItem: editingPost.savedItem,
          action: editingPost.action,
          message: editingPost.message,
          memeText: editingPost.memeText || null,
        });
        setEditingPost(null);
        setIsFormOpen(false);
        return;
      }

      if (!newPost.savedItem || !newPost.action || !newPost.author) return;

      const randomChar: Character = Math.random() > 0.5 ? 'RICO' : 'BORI';
      const comments = randomChar === 'RICO' ? RICO_COMMENTS : BORI_COMMENTS;
      const randomComment = comments[Math.floor(Math.random() * comments.length)];

      await addDoc(collection(db, 'posts'), {
        author: newPost.author,
        savedItem: newPost.savedItem,
        action: newPost.action,
        message: newPost.message,
        memeText: newPost.memeText || null,
        characterComment: { character: randomChar, text: randomComment },
        likes: 0,
        reactions: { clap: 0, fire: 0 },
        createdAt: Timestamp.now(),
      });

      setIsFormOpen(false);
      setNewPost({ author: '', savedItem: '', action: '', message: '', memeText: '' });
    } catch (err) {
      handleFirestoreError(err, editingPost ? OperationType.UPDATE : OperationType.CREATE, 'posts');
    }
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const post = posts.find(p => p.id === id);
      if (post?.isSample) {
        setPosts(posts.filter(p => p.id !== id));
        setDeletingPostId(null);
        return;
      }

      await deleteDoc(doc(db, 'posts', id));
      setDeletingPostId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${id}`);
    }
  };

  const handleLike = async (id: string) => {
    try {
      const post = posts.find(p => p.id === id);
      if (post?.isSample) {
        setPosts(posts.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
        return;
      }

      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        likes: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    }
  };

  const handleReaction = async (id: string, type: keyof Post['reactions']) => {
    try {
      const post = posts.find(p => p.id === id);
      if (post?.isSample) {
        setPosts(posts.map(p => p.id === id ? { 
          ...p, 
          reactions: { ...p.reactions, [type]: p.reactions[type] + 1 } 
        } : p));
        return;
      }

      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        [`reactions.${type}`]: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    }
  };

  const userPosts = posts.filter(p => !p.isSample);
  const cumulativeCount = userPosts.length;
  // 절약 지수: 신규 게시글 1건당 5%씩 상승 (최대 100%)
  const savingsIndex = Math.min(cumulativeCount * 5, 100);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#483729] font-sans pb-10">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-100 px-6 py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-[#E86A33] p-2 rounded-xl shadow-inner">
            <Zap className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-[#E86A33]">해마루 그린 챌린지</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Haemaru Green Campaign</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-2xl">
          <span className="hover:rotate-12 transition-transform cursor-default">{RICO_EMOJI}</span>
          <span className="hover:-rotate-12 transition-transform cursor-default">{BORI_EMOJI}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-8">
        {/* Top Section: Stats */}
        <section className="mb-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] p-8 shadow-xl shadow-orange-100/50 border border-orange-50 relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏥</span>
                <h2 className="text-xl font-black">오늘의 절약 현황</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6 font-medium">우리 병원의 소중한 자산, 함께 지켜요!</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <p className="text-[10px] font-bold text-orange-400 mb-1">누적 인증</p>
                  <p className="text-2xl font-black text-[#E86A33]">{cumulativeCount}<span className="text-sm font-bold ml-1">건</span></p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-400 mb-1">절약 지수</p>
                  <p className="text-2xl font-black text-blue-600">{savingsIndex}<span className="text-sm font-bold ml-1">%</span></p>
                </div>
              </div>
            </div>
            
            {/* Background Character Decor */}
            <div className="absolute -right-6 -bottom-6 text-7xl opacity-10 rotate-12">
              {BORI_EMOJI}
            </div>
          </motion.div>
        </section>

        {/* Feed */}
        <div className="space-y-8">
          <AnimatePresence>
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2.5rem] shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden"
              >
                {/* Post Header */}
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl shadow-inner">
                      🏥
                    </div>
                    <div>
                      <p className="font-black text-base">{post.author}</p>
                      <p className="text-[11px] font-bold text-gray-300">
                        {post.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEdit(post)}
                      className="p-2 text-gray-300 hover:text-blue-500 transition-colors"
                      title="수정"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeletingPostId(post.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-6 pb-8">
                  <div className="bg-[#FDFBF7] rounded-3xl p-6 border border-orange-50 mb-6 shadow-inner">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="flex items-center gap-2 bg-[#E86A33] text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-sm">
                        <Syringe className="w-3 h-3" />
                        아낀 소모품: {post.savedItem}
                      </div>
                      <div className="flex items-center gap-2 bg-[#483729] text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-sm">
                        <Scissors className="w-3 h-3" />
                        절약 행동: {post.action}
                      </div>
                    </div>
                    <p className="text-base leading-relaxed font-medium text-[#483729]">{post.message}</p>
                  </div>

                  {/* Meme Text */}
                  {post.memeText && (
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="mb-6 text-center py-5 px-6 bg-yellow-50 border-2 border-dashed border-yellow-200 rounded-2xl"
                    >
                      <p className="font-black text-xl italic text-yellow-700 tracking-tight">"{post.memeText}"</p>
                    </motion.div>
                  )}

                  {/* Image */}
                  {post.imageUrl && (
                    <div className="rounded-3xl overflow-hidden mb-6 border border-gray-100 shadow-md">
                      <img 
                        src={post.imageUrl} 
                        alt="절약 인증" 
                        className="w-full h-auto object-cover max-h-80"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Character Comment */}
                  <SpeechBubble 
                    character={post.characterComment.character} 
                    text={post.characterComment.text} 
                  />

                  {/* Interactions */}
                  <div className="mt-8 pt-6 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                      <button 
                        onClick={() => handleLike(post.id)}
                        className="flex items-center gap-2 group"
                      >
                        <Heart className={`w-5 h-5 transition-all duration-300 ${post.likes > 0 ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-300 group-hover:text-red-500 group-hover:scale-110'}`} />
                        <span className="text-xs font-black text-gray-500">{post.likes}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleReaction(post.id, 'clap')}
                          className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-orange-50 transition-all text-base shadow-sm"
                        >
                          👏 <span className="ml-1 text-[10px] font-black">{post.reactions.clap}</span>
                        </button>
                        <button 
                          onClick={() => handleReaction(post.id, 'fire')}
                          className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-orange-50 transition-all text-base shadow-sm"
                        >
                          🔥 <span className="ml-1 text-[10px] font-black">{post.reactions.fire}</span>
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsFormOpen(true)}
                      className="w-full sm:w-auto text-[10px] font-black text-[#E86A33] bg-orange-50 px-4 py-2 rounded-xl hover:bg-orange-100 transition-all active:scale-95 shadow-sm"
                    >
                      나도 해볼게요
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Action Button */}
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsFormOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#E86A33] text-white rounded-2xl shadow-2xl shadow-orange-500/30 flex items-center justify-center z-40"
      >
        <Plus className="w-10 h-10" />
      </motion.button>

      {/* Post Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{BORI_EMOJI}</span>
                  <h2 className="text-2xl font-black">{editingPost ? '인증 수정하기 ✏️' : '절약 인증하기 ✍️'}</h2>
                </div>
                <button 
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingPost(null);
                  }} 
                  className="p-3 hover:bg-gray-100 rounded-2xl transition-colors"
                >
                  <X className="w-7 h-7" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2 pb-4 custom-scrollbar">
                <div>
                  <label className="block text-[11px] font-black mb-2 text-gray-400 uppercase tracking-widest">작성자 이름</label>
                  <input 
                    type="text" 
                    placeholder="성함을 입력해주세요 (예: 김테크)"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#E86A33] focus:bg-white transition-all outline-none font-bold"
                    value={editingPost ? editingPost.author : newPost.author}
                    onChange={(e) => {
                      if (editingPost) setEditingPost({ ...editingPost, author: e.target.value });
                      else setNewPost({ ...newPost, author: e.target.value });
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black mb-2 text-gray-400 uppercase tracking-widest">아낀 소모품</label>
                  <input 
                    type="text" 
                    placeholder="예: 거즈, 알코올 솜, 테이프 등"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#E86A33] focus:bg-white transition-all outline-none font-bold"
                    value={editingPost ? editingPost.savedItem : newPost.savedItem}
                    onChange={(e) => {
                      if (editingPost) setEditingPost({ ...editingPost, savedItem: e.target.value });
                      else setNewPost({ ...newPost, savedItem: e.target.value });
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black mb-2 text-gray-400 uppercase tracking-widest">절약 행동</label>
                  <input 
                    type="text" 
                    placeholder="예: 필요한 만큼만 소분, 재활용 등"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#E86A33] focus:bg-white transition-all outline-none font-bold"
                    value={editingPost ? editingPost.action : newPost.action}
                    onChange={(e) => {
                      if (editingPost) setEditingPost({ ...editingPost, action: e.target.value });
                      else setNewPost({ ...newPost, action: e.target.value });
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black mb-2 text-gray-400 uppercase tracking-widest">한마디</label>
                  <textarea 
                    placeholder="동료들에게 절약 팁을 공유해주세요!"
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[#E86A33] focus:bg-white transition-all outline-none font-bold h-28 resize-none"
                    value={editingPost ? editingPost.message : newPost.message}
                    onChange={(e) => {
                      if (editingPost) setEditingPost({ ...editingPost, message: e.target.value });
                      else setNewPost({ ...newPost, message: e.target.value });
                    }}
                  />
                </div>

                {/* Meme Generator */}
                <div className="flex flex-col gap-3">
                  <button 
                    type="button"
                    onClick={generateMeme}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-dashed border-orange-200 text-[#E86A33] font-black text-sm hover:bg-orange-50 transition-all active:scale-95"
                  >
                    <RefreshCw className="w-5 h-5" />
                    랜덤 절약 밈 생성 🔥
                  </button>
                  {(editingPost?.memeText || newPost.memeText) && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-yellow-50 px-5 py-3 rounded-2xl border border-yellow-100 flex items-center justify-between"
                    >
                      <span className="text-xs font-black italic text-yellow-700">"{editingPost ? editingPost.memeText : newPost.memeText}"</span>
                      <button 
                        onClick={() => {
                          if (editingPost) setEditingPost({ ...editingPost, memeText: '' });
                          else setNewPost({ ...newPost, memeText: '' });
                        }} 
                        className="text-yellow-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-[#E86A33] text-white font-black text-lg rounded-[2rem] shadow-xl shadow-orange-500/20 hover:bg-[#d45a2a] transition-all active:scale-95 mt-4"
                >
                  {editingPost ? '수정 완료! ✨' : '인증 완료! 🚀'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingPostId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingPostId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[2rem] p-8 w-full max-w-xs text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black mb-2">게시글 삭제</h3>
              <p className="text-sm text-gray-500 mb-8 font-medium">정말로 이 게시글을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingPostId(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 font-black rounded-xl hover:bg-gray-200 transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={() => handleDelete(deletingPostId)}
                  className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fixed Character Decor (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-10 pointer-events-none opacity-40 sm:opacity-100 text-5xl animate-bounce">
        {RICO_EMOJI}
      </div>
    </div>
  );
}
