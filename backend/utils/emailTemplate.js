// emailTemplate.js
const appointmentEmailTemplate = (appointment) => {
  const { patient, doctor, location, slot, serialNo, date, status } =
    appointment;

  const formattedDate = new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="color: #2b6cb0;">Appointment Confirmation</h2>
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>Your appointment details are as follows:</p>
      <ul>
        <li><strong>Doctor:</strong> Dr. ${doctor.name}</li>
 
        <li><strong>Date:</strong> ${formattedDate}</li>
        <li><strong>Time Slot:</strong> ${slot.startTime} - ${slot.endTime}</li>
        <li><strong>Location:</strong> ${location.name}</li>
        <li><strong>Token No:</strong> ${serialNo}</li>
        <li><strong>Status:</strong> ${
          status === "confirmed"
            ? "<span style='color: green;'>Confirmed ✅</span>"
            : "<span style='color: orange;'>Waiting for Final Approval ⏳</span>"
        }</li>
      </ul>

      <p style="margin-top: 16px;">Please arrive at least <strong>10 minutes early</strong>.</p>
      <p>Thank you for choosing our service!</p>

      <hr />
      <p style="font-size: 12px; color: gray;">CarePad Clinic | Dhaka, Bangladesh</p>
    </div>
  `;
};

module.exports = { appointmentEmailTemplate };
