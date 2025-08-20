import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Welcome to FastChat! 🚀
        </h1>
        <p className="text-gray-600 mb-4">
          Your real-time chat application is ready to go.
        </p>
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <strong>Status:</strong> Backend health endpoint is working!
        </div>
      </div>
    </div>
  )
}

export default App
