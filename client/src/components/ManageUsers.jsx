import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/ManageUsers.css";

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [username, setUsername] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (!isLoggedIn || isLoggedIn !== "true") {
      navigate("/");
      return;
    }

        // Load user information
        const currentUser = localStorage.getItem("currentUser");
        setUsername(currentUser || "Admin");

    // Load dark mode preference
    const savedMode = localStorage.getItem("darkMode");
    setDarkMode(savedMode ? JSON.parse(savedMode) : false);

    // Fetch users data from API
    loadUsersData();
  }, [navigate]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", JSON.stringify(newMode));
  };

  const loadUsersData = () => {
    setLoading(true);
    
    axios.get("http://localhost:5000/api/registrations")
      .then(response => {
        // Transform the registration data to match the expected format
        const formattedUsers = response.data.registrations.map(reg => ({
          id: reg._id,
          name: `${reg.firstName} ${reg.lastName}`,
          username: reg.indexNumber, // Using index number as username
          email: reg.email,
          registrationDate: reg.registrationDate || new Date(),
          department: reg.degreeProgram || "",
          position: reg.intake || "",
          active: reg.verified !== undefined ? reg.verified : true,
          photoUrl: reg.photos?.front || "" // Using front photo as avatar
        }));
        setUsers(formattedUsers);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error loading registrations:", error);
        setLoading(false);
        setUsers([]);
      });
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) || // This would be the index number
      user.id?.toString().includes(searchTerm)
    );
  });

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowConfirmModal(true);
  };

  const confirmDelete = () => {
    if (!userToDelete) return;
    
    axios.delete(`http://localhost:5000/api/registrations/${userToDelete.id}`)
      .then(() => {
        // Remove user from state
        const updatedUsers = users.filter((u) => u.id !== userToDelete.id);
        setUsers(updatedUsers);
        
        // Reset selected user if the deleted user was selected
        if (selectedUser && selectedUser.id === userToDelete.id) {
          setSelectedUser(null);
        }
        
        // Hide modal
        setShowConfirmModal(false);
        setUserToDelete(null);
      })
      .catch(error => {
        console.error("Error deleting registration:", error);
      });
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
    setUserToDelete(null);
  };

  const handleBackClick = () => {
    navigate("/Dashboard");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={`manage-users-container ${darkMode ? "dark-mode" : ""}`}>
      <div className="background-animation"></div>
      <div className="particles"></div>

      <div className="manage-users-header">
        <button className="back-button-manage" onClick={handleBackClick}>
          ← Back to Dashboard
        </button>
        <h1>Manage Registrations</h1>
        <div className="dark-mode-toggle" onClick={toggleDarkMode}>
            {darkMode ? (
              <i className="mode-icon sun-icon">☀️</i>
            ) : (
              <i className="mode-icon moon-icon">🌙</i>
            )}
          </div>
          <div className="user-info-manage">
            <span>Welcome, {username}</span>
          </div>
      </div>

      <div className="manage-users-content">
        <div className="search-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by name, email, or index number..."
              value={searchTerm}
              onChange={handleSearch}
            />
            <span className="search-icon">🔍</span>
          </div>
          <div className="user-count">
            {filteredUsers.length} registration{filteredUsers.length !== 1 ? "s" : ""} found
          </div>
        </div>

        <div className="users-management-panel">
          <div className="users-list-section">
            {loading ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Loading registrations...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="no-users-message">
                <p>No registrations found.</p>
                {searchTerm ? (
                  <p>Try a different search term or clear the search.</p>
                ) : (
                  <p>Start by registering new students in the system.</p>
                )}
              </div>
            ) : (
              <div className="users-table">
                <div className="table-header">
                  <div className="header-cell name-cell">Name</div>
                  <div className="header-cell username-cell">Index Number</div>
                  <div className="header-cell registered-cell">Registered</div>
                  <div className="header-cell actions-cell">Actions</div>
                </div>
                <div className="table-body">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className={`table-row ${
                        selectedUser && selectedUser.id === user.id
                          ? "selected-row"
                          : ""
                      }`}
                      onClick={() => handleUserSelect(user)}
                    >
                      <div className="cell name-cell">{user.name}</div>
                      <div className="cell username-cell">{user.username}</div>
                      <div className="cell registered-cell">
                        {formatDate(user.registrationDate)}
                      </div>
                      <div className="cell actions-cell">
                        <button
                          className="view-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUserSelect(user);
                          }}
                        >
                          View
                        </button>
                        <button
                          className="delete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(user);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="user-details-section">
            {selectedUser ? (
              <div className="user-details-card">
                <div className="user-avatar">
                  {selectedUser.photoUrl ? (
                    <img src={selectedUser.photoUrl} alt="User avatar" />
                  ) : (
                    <div className="avatar-placeholder">
                      {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                </div>
                <h2>{selectedUser.name}</h2>
                <div className="user-info">
                  <div className="info-row">
                    <div className="info-label">Index Number:</div>
                    <div className="info-value">{selectedUser.username}</div>
                  </div>
                  <div className="info-row">
                    <div className="info-label">Email:</div>
                    <div className="info-value">{selectedUser.email}</div>
                  </div>
                  <div className="info-row">
                    <div className="info-label">Registration ID:</div>
                    <div className="info-value">{selectedUser.id}</div>
                  </div>
                  <div className="info-row">
                    <div className="info-label">Registered:</div>
                    <div className="info-value">
                      {formatDate(selectedUser.registrationDate)}
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-label">Program:</div>
                    <div className="info-value">
                      {selectedUser.department || "Not specified"}
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-label">Intake:</div>
                    <div className="info-value">
                      {selectedUser.position || "Not specified"}
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-label">Status:</div>
                    <div className="info-value">
                      <span className={`status-badge ${selectedUser.active ? "active" : "inactive"}`}>
                        {selectedUser.active ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="user-actions">
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteClick(selectedUser)}
                  >
                    Delete Registration
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-selection-message">
                <div className="placeholder-icon">👤</div>
                <p>Select a registration to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete the registration for{" "}
              <strong>{userToDelete?.name}</strong>?
            </p>
            <p className="warning-text">
              This action cannot be undone. All registration data including photos
              and verification information will be permanently removed.
            </p>
            <div className="modal-actions">
              <button className="cancel-button" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="confirm-button" onClick={confirmDelete}>
                Delete Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;