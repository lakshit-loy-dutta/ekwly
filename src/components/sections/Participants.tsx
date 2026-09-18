interface Props {
	people: string[];
	newPersonName: string;
	setNewPersonName: (val: string) => void;
	handleAddPerson: () => void;
	handleRemovePerson: (name: string) => void;
}

export default function Participants(props: Props) {
	return (
		<section className="rounded-2xl p-6 md:p-8 bg-surface shadow-stripe border border-border">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="text-xl font-semibold tracking-tight text-main">
						Participants
					</h2>
					<p className="text-sm text-muted mt-1">
						Who is splitting the bill today?
					</p>
				</div>
				<span className="bg-subtle text-muted text-xs font-semibold px-3 py-1 rounded-full border border-border">
					Step 3 of 5
				</span>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-[2fr_auto] gap-4 md:items-end">
				<div className="flex flex-col gap-1.5">
					<label className="text-sm font-medium text-main">
						Participant Name
					</label>
					<input
						type="text"
						value={props.newPersonName}
						onChange={(e) => props.setNewPersonName(e.target.value)}
						onKeyDown={(e) =>
							e.key === "Enter" && props.handleAddPerson()
						}
						placeholder="e.g., Lakshit"
					/>
				</div>
				<div>
					<button
						type="button"
						className="h-[44px] w-full md:w-auto px-6 bg-surface hover:bg-subtle text-main border border-border rounded-md shadow-sm font-medium text-sm transition-colors"
						onClick={props.handleAddPerson}>
						Add Person
					</button>
				</div>
			</div>

			<div className="flex flex-wrap gap-2.5 mt-6">
				{props.people.length === 0 && (
					<span className="text-sm text-muted">
						No participants added yet.
					</span>
				)}
				{props.people.map((p) => (
					<div
						key={p}
						className="inline-flex items-center gap-2 px-4 py-2 bg-subtle border border-border rounded-full text-sm font-medium text-main shadow-sm">
						<svg
							className="text-muted"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2">
							<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
							<circle cx="12" cy="7" r="4" />
						</svg>
						<span>{p}</span>
						<button
							type="button"
							className="text-muted hover:text-danger ml-1 p-0.5 rounded-full hover:bg-danger-light transition-colors"
							onClick={() => props.handleRemovePerson(p)}>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5">
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>
						</button>
					</div>
				))}
			</div>
		</section>
	);
}
