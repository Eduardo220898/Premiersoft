using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade de relacionamento entre Paciente e suas classificações CID-10
/// </summary>
public class DiagnosticoPaciente
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int PacienteId { get; set; }
    
    [Required]
    public int ClassificacaoCID10Id { get; set; }
    
    public DateTime DataDiagnostico { get; set; } = DateTime.UtcNow;
    
    [StringLength(50)]
    public string TipoDiagnostico { get; set; } = "Principal"; // Principal, Secundário, Suspeita
    
    [StringLength(1000)]
    public string? Observacoes { get; set; }
    
    [StringLength(100)]
    public string? MedicoResponsavel { get; set; }
    
    [StringLength(50)]
    public string StatusDiagnostico { get; set; } = "Ativo"; // Ativo, Resolvido, Em Tratamento
    
    public DateTime? DataResolucao { get; set; }
    
    // Relacionamentos
    [ForeignKey("PacienteId")]
    public virtual Paciente Paciente { get; set; } = null!;
    
    [ForeignKey("ClassificacaoCID10Id")]
    public virtual ClassificacaoCID10 ClassificacaoCID10 { get; set; } = null!;
}
