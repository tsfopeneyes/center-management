import React, { useEffect } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {
    Bold, Italic, Underline as UnderlineIcon,
    List, ListOrdered, Quote, Heading1, Heading2,
    AlignLeft, AlignCenter, AlignRight,
    Link as LinkIcon, Image as ImageIcon,
    Undo, Redo, Highlighter
} from 'lucide-react';

const MenuButton = ({ onClick, isActive, disabled, children, title }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-2 rounded-lg transition-all ${isActive
            ? 'bg-blue-100 text-blue-600'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
        {children}
    </button>
);

const ModernEditor = ({ content, onChange, placeholder = '내용을 입력하세요...' }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 underline cursor-pointer',
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'rounded-2xl max-w-full h-auto border border-gray-100 my-4',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Highlight.configure({
                multicolor: true,
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none min-h-[300px] max-w-none text-gray-800',
            },
        },
    });

    // Update content if it changes externally (e.g. during initial load or edit reset)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    const addImage = () => {
        const url = window.prompt('이미지 URL을 입력하세요');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL을 입력하세요', previousUrl);

        if (url === null) {
            return;
        }

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="w-full border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-gray-950/5">
            {/* Main Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-50 bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
                <div className="flex items-center gap-1 border-r border-gray-200 pr-1 mr-1">
                    <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="되돌리기"><Undo size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="다시 실행"><Redo size={18} /></MenuButton>
                </div>

                <div className="flex items-center gap-1 border-r border-gray-200 pr-1 mr-1">
                    <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="대제목"><Heading1 size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="소제목"><Heading2 size={18} /></MenuButton>
                </div>

                <div className="flex items-center gap-1 border-r border-gray-200 pr-1 mr-1">
                    <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="굵게"><Bold size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="기울임"><Italic size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="밑줄"><UnderlineIcon size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="형광펜"><Highlighter size={18} /></MenuButton>
                </div>

                <div className="flex items-center gap-1 border-r border-gray-200 pr-1 mr-1">
                    <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="왼쪽 정렬"><AlignLeft size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="가운데 정렬"><AlignCenter size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="오른쪽 정렬"><AlignRight size={18} /></MenuButton>
                </div>

                <div className="flex items-center gap-1 border-r border-gray-200 pr-1 mr-1">
                    <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="글머리 기호"><List size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="번호 매기기"><ListOrdered size={18} /></MenuButton>
                    <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="인용구"><Quote size={18} /></MenuButton>
                </div>

                <div className="flex items-center gap-1">
                    <MenuButton onClick={setLink} isActive={editor.isActive('link')} title="링크"><LinkIcon size={18} /></MenuButton>
                    <MenuButton onClick={addImage} title="이미지"><ImageIcon size={18} /></MenuButton>
                </div>
            </div>

            {/* Bubble Menu for quick access */}
            {
                editor && (
                    <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex items-center bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden px-1 py-1">
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`p-1.5 rounded hover:bg-gray-800 transition ${editor.isActive('bold') ? 'text-blue-400' : 'text-white'}`}
                        >
                            <Bold size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={`p-1.5 rounded hover:bg-gray-800 transition ${editor.isActive('italic') ? 'text-blue-400' : 'text-white'}`}
                        >
                            <Italic size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            className={`p-1.5 rounded hover:bg-gray-800 transition ${editor.isActive('underline') ? 'text-blue-400' : 'text-white'}`}
                        >
                            <UnderlineIcon size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().toggleHighlight().run()}
                            className={`p-1.5 rounded hover:bg-gray-800 transition ${editor.isActive('highlight') ? 'text-yellow-400' : 'text-white'}`}
                        >
                            <Highlighter size={16} />
                        </button>
                        <div className="w-[1px] h-4 bg-gray-700 mx-1" />
                        <button
                            type="button"
                            onClick={setLink}
                            className={`p-1.5 rounded hover:bg-gray-800 transition ${editor.isActive('link') ? 'text-blue-400' : 'text-white'}`}
                        >
                            <LinkIcon size={16} />
                        </button>
                    </BubbleMenu>
                )
            }

            <EditorContent editor={editor} />

            <style>{`
                .tiptap p.is-editor-empty:first-child::before {
                    color: #adb5bd;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                /* Higher specificity to override prose defaults if needed */
                .tiptap.prose {
                    max-width: none;
                }
                .tiptap.prose :first-child {
                    margin-top: 0;
                }
                .tiptap.prose :last-child {
                    margin-bottom: 0;
                }
                .tiptap {
                    font-family: inherit;
                }
            `}</style>
        </div >
    );
};

export default ModernEditor;
