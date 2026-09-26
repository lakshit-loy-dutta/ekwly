import { useState } from "react";
import { BarcodeScanner } from "@capacitor-community/barcode-scanner";
import { showToast } from "../lib/utils";

interface Props {
	onStartNew: () => void;
	onJoinSession: (sessionId: string) => void;
}

export default function Home({ onStartNew, onJoinSession }: Props) {
	const [isScanning, setIsScanning] = useState(false);

	const startScan = async () => {
		try {
			const status = await BarcodeScanner.checkPermission({
				force: true,
			});
			if (!status.granted) {
				showToast("Camera permission denied", "error");
				return;
			}
			document.body.style.background = "transparent";
			setIsScanning(true);
			const result = await BarcodeScanner.startScan();
			BarcodeScanner.stopScan();
			document.body.style.background = "";
			setIsScanning(false);
			if (result.hasContent) {
				const scannedUrl = result.content;
				const sessionId = scannedUrl.split("/").pop();
				if (sessionId) onJoinSession(sessionId);
				else showToast("Invalid Ekwly QR Code", "error");
			}
		} catch (error) {
			console.error(error);
			BarcodeScanner.stopScan();
			document.body.style.background = "";
			setIsScanning(false);
			showToast("Error launching scanner", "error");
		}
	};

	const stopScan = () => {
		BarcodeScanner.stopScan();
		document.body.style.background = "";
		setIsScanning(false);
	};

	if (isScanning) {
		return (
			<div className="fixed inset-0 z-50 flex flex-col items-center justify-end pb-12 bg-black/40">
				<div className="w-64 h-64 border-2 border-white/50 rounded-2xl mb-8 relative">
					<div className="absolute inset-0 border-primary border-t-2 border-b-2 rounded-2xl animate-pulse"></div>
				</div>
				<p className="text-white font-medium mb-8 shadow-sm">
					Scan a Session QR Code
				</p>
				<button
					type="button"
					onClick={stopScan}
					className="bg-white text-main px-8 py-3 rounded-full font-bold shadow-lg">
					Cancel Scan
				</button>
			</div>
		);
	}

	return (
		<div className="w-full flex flex-col flex-1 px-6">
			<div className="flex flex-col items-center justify-center flex-1 py-12">
				<img
					src="/icon.svg"
					width="80"
					height="80"
					alt="Ekwly Logo"
					className="rounded-2xl shadow-sm mb-6"
				/>
				<h2 className="text-3xl font-bold tracking-tight text-main mb-2">
					Ekwly
				</h2>
				<p className="text-muted text-center text-sm max-w-xs">
					Create a new bill session or scan a QR code to join your
					table.
				</p>
			</div>

			<div className="flex flex-col gap-4 pb-12">
				<button
					type="button"
					onClick={onStartNew}
					className="w-full h-16 bg-primary active:bg-primary-hover text-white rounded-2xl shadow-stripe flex flex-col items-center justify-center transition-colors">
					<span className="font-semibold text-lg">
						Create New Session
					</span>
					<span className="text-primary-light text-xs font-medium uppercase tracking-wider">
						Host
					</span>
				</button>

				<button
					type="button"
					onClick={startScan}
					className="w-full h-16 bg-surface active:bg-subtle text-main border-2 border-border rounded-2xl shadow-sm flex flex-col items-center justify-center transition-colors">
					<span className="font-semibold text-lg">Scan to Join</span>
					<span className="text-muted text-xs font-medium uppercase tracking-wider">
						Participant
					</span>
				</button>
			</div>
		</div>
	);
}
