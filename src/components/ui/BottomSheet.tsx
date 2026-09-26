import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}

export default function BottomSheet({
	isOpen,
	onClose,
	title,
	children,
}: Props) {
	// Lock background scrolling when the sheet is open
	useEffect(() => {
		if (isOpen) document.body.style.overflow = "hidden";
		else document.body.style.overflow = "unset";
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
					/>
					<motion.div
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						exit={{ y: "100%" }}
						transition={{
							type: "spring",
							damping: 28,
							stiffness: 300,
						}}
						className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[85vh] bg-surface rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-border pb-safe">
						<div className="flex items-center justify-between p-6 pb-4 border-b border-border">
							<h3 className="text-xl font-bold text-main tracking-tight">
								{title}
							</h3>
							<button
								onClick={onClose}
								className="p-2 bg-subtle hover:bg-border rounded-full text-muted transition-colors">
								<X size={20} />
							</button>
						</div>
						<div className="p-6 overflow-y-auto overscroll-contain">
							{children}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
