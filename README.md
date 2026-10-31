# Trex Up 🚀

Autonomous Multi-Modal Experimental & Verification Agent built for the **Meta Global AI Developer Hackathon**.

## Architecture Pattern

Following Meta's verifiable agent blueprint:

- `agent/`: The autonomous agentic loop (`Plan -> Act -> Observe`), tool registry, and multi-tier verification checks.
- `cases/`: The case/scenario dossiers, objectives, documents, and visual inputs.
- `ground_truth/`: Benchmark evaluation criteria and ground-truth standards.
- `world/`: The simulation environment / outside world interactions.
- `ui/`: The interactive real-time visual console for monitoring agent progress and human-in-the-loop sign-off.
